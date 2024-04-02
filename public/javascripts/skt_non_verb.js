const puppeteer = require('puppeteer');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const sleep = milliseconds =>
  new Promise(resolve =>
    setTimeout(resolve, milliseconds)
  );
let counter_id = 0; // counter_id変数を定義

async function scrapeUrl(url, replacements) {

  console.log(url);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle0' });
  const h2Text = await page.$eval('h2', node => node.textContent.trim());
  // tobody下の最初のtr要素のHTMLを取得
  const trfirstchild = await page.$eval('tbody > tr:first-child', element => element.innerHTML);
  let gender;  
  let wordClass;
  if(h2Text.includes('男性')){
    gender = '男性';
  }else if(h2Text.includes('女性')){
    gender = '女性';
  }else if(h2Text.includes('中性')){
    gender = '中性';
  }else if(trfirstchild.includes('男')){
    gender = '男性';
  }else if(trfirstchild.includes('女')){
    gender = '女性';
  }else if(trfirstchild.includes('中')){
    gender = '中性';
  }
  
  if(h2Text.includes('形容詞')){
    wordClass = '形容詞';
  }else if(url.includes('tb=n')){
    wordClass = '名詞';
  }

  // body直下に直接書き込まれているすべてのテキストを取得
  const directTexts = await page.evaluate(() => {
    // body直下に直接書き込まれているテキストを取得
    const directTextElements = Array.from(document.querySelector('body').childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent.trim())
      .join(',');

    // 改行を<br>で区切って配列に分割し、空の要素をフィルタリングする
    const textArray = directTextElements.split(',').filter(item => item !== '');;
    return textArray;
  });

  const data = [];
  let tableCount = await page.$$eval('table', tables => tables.length);
  if(url == 'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nt&bm=at'){
    tableCount = tableCount - 1;
  }
  for (let tableIndex = 0; tableIndex < tableCount; tableIndex++) {
    const regex = /-(.*?)(?: |(?=と))/g;
    const match = h2Text.match(regex);
    let root = '';
    if (match) {
      if(wordClass == '形容詞' && h2Text.includes('女性') && tableIndex == 1){
        root = match[1].replace(/-/g, '').replace(/ /g, '');
      }else{
        root = match[0].replace(/-/g, '').replace(/ /g, ''); 
      }
    }

    let columns;
    const selector_checker = `table:nth-child(${tableIndex + 2}) > tbody > tr:last-child > td`;

    const tdCount = await page.$$eval(selector_checker , tds => tds.length);
    if (tdCount == 2) {
      columns = [2];
    } else if(tdCount == 4){
      columns = [2, 3, 4];
    } else if(tdCount == 8){
      columns = [2, 3, 4, 6, 7, 8];
    } else if(tdCount == 5){
      columns = [2, 3, 4];
    }

    let startRow = (tableCount > 1 && tableIndex === 0) ? 4 : 3;
    
    let flg_unique_nj = false;
    let titletext;
    const array_consonant = ['tb=nj', 'tb=nc', 'tb=nt'];
    // 少なくとも一つ以上の要素を含むかどうかを判定
    const includesAny = array_consonant.some(element => url.includes(element));

    let flg_alltext = false;
    let flg_stem = false;
    if(includesAny){
      if((url.includes('bm=ht') && !(url.includes('ht3'))) || tableIndex == 1){
        startRow = 3;
      }else{
        startRow = 4;
      }
      let root_text = h2Text.match(/-(.*)/);
      if(h2Text.includes('-')){
        root = root_text[1].replace(' ','');
      }else{
        root = h2Text;
        flg_alltext = true;
      }
      
      if(url.includes('bm=ac')){
        flg_stem = true;
      }
      if(url == 'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nt&bm=atd'){
        flg_stem = true;
      }
      const regex = /(.*?)-/g;
      let title;
      if(url.includes('bm=t')){
        title = await page.$eval(`table:nth-child(2) > tbody > tr:nth-child(2) > td:first-child`, node => node.textContent.trim());
      }else{
        title = await page.$eval(`table:nth-child(2) > tbody > tr:first-child > td:first-child`, node => node.textContent.trim());
      }
      
      titletext = title.match(regex)[0].replace(/-/g, '').replace(/ /g, '');
      if(root.includes('（語幹子音有気化）')){
        root = 'u' + root.replace('（語幹子音有気化）', ''); // カッコとその中身を削除;
        flg_unique_nj = true;
      }else if(h2Text.includes('語幹')){
        const regex = /-(.*?)(?=\()/g;
        root = h2Text.match(regex)[0].replace(/-/g, '').replace(/ /g, '');
      }else if(root.includes('(')){
        const regex = /-(.*?)(?: |(?=()))/g;
        root = h2Text.match(regex)[0].replace(/-/g, '').replace(/ /g, '');
        console.log(root)
      }
    }
    
    let endRow;
    endRow = 8 + startRow;

    for (let row = startRow; row < endRow; row++) {
      for (let column of columns) {

        let remark = '';
        let flg_unique = false;
        if(h2Text.includes('特殊')){
          flg_unique = true;
        }else if(url.includes('tb=nj') && flg_unique_nj == true){
          flg_unique = true;
          remark = '語幹子音有気化';
        }

        if(h2Text.includes('特殊')){
          if(h2Text.includes(' 特殊') || h2Text.includes('行為者')){
            const regex = /^(.*?)\(/; // 「(」より前の文字列を抽出する正規表現パターン
            const match = h2Text.match(regex);
            root = match[1].replace(/-/g, '').replace(/ /g, ''); 
            remark = '特殊変化' + '(' + root + ')';
          }else{
            const regexParentheses_insideParentheses = /\(([^()]+)\)/;
            remark = h2Text.match(regexParentheses_insideParentheses)[1];
            const regex = /-(.*?)(?: |(?=と))/g;
            const match = h2Text.match(regex);
            root = match[1].replace(/-/g, '').replace(/ /g, ''); 
          }
        }
        
        if(tableCount > 1){
          if(tableIndex == 0 && column < 5){
            gender = '男性';
          }else if(tableIndex == 0 && column > 5){
            gender = '中性';
          }else {
            gender = '女性';
          }
        }


        if(includesAny){
          if(column < 5){
            if(url.includes('bm=ht')){
              if(!(url.includes('ht3'))){
                gender = '女性';
              }
            }else{
              if(tableCount == 1){
                gender = '男性女性';                
              }
            }
          }else{
            gender = '中性';
          }
        }
        if(url.includes('bm=ht')){
          remark = h2Text.match(/\([^()]*\)/g)[0].replace(/\(/g, '').replace(/\)/g, '').replace(/\n/g, '').replace('するもの', '');
        }
        if(url == 'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nu&bm=ua' && gender == '女性'){
          let num;
          if(column<5){
            num = 1;
          }else{
            num = 2;
          }
          remark_text = await page.$eval(`table:nth-child(${tableIndex + 2}) > tbody > tr:nth-child(${startRow - 2}) > td:nth-child(${num})`, node => node.textContent.trim());   
          remark = remark_text;
        }
        if(url == 'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nr&bm=rmr'){
          remark = 'naptṛ-(孫)bhartṛ-(夫)を除いた親族';
          flg_unique = true;
        }
        if(url == 'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nr&bm=rfr'){
          remark = 'svasṛ-(姉妹)を除いた親族';
          flg_unique = true;
        }
        if(url == 'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nr&bm=div'){
          root = 'div'
          remark = '特殊変化(div)';    
        }

        const selector = `table:nth-child(${tableIndex + 2}) > tbody > tr:nth-child(${row}) > td:nth-child(${column})`;
        let elementExists_yellow;
      
        // 指定されたセレクタにマッチする要素が存在するかを判定        
        elementExists_yellow = await page.evaluate((selector) => {
          const element = document.querySelector(selector);
          
          return element ? element.getAttribute('bgcolor') === 'yellow' : false;
        }, selector);
        
        const elementExists_aqua = await page.evaluate((selector) => {
          const element = document.querySelector(selector);
          
          return element ? element.getAttribute('bgcolor') === 'aqua' : false;
        }, selector);
        
        const textInFirstColumn = await page.$eval(`table:nth-child(${tableIndex + 2}) > tbody > tr:nth-child(${row}) > td:nth-child(1)`, node => node.textContent.trim());
        
        let textInFirstRow;
        if(tdCount>6){
          textInFirstRow = await page.$eval(`table:nth-child(${tableIndex + 2}) > tbody > tr:nth-child(${startRow - 1}) > td:nth-child(${column})`, node => node.textContent.trim()); 
        }else{
          textInFirstRow = await page.$eval(`table:nth-child(${tableIndex + 2}) > tbody > tr:nth-child(${startRow - 1}) > td:nth-child(${column})`, node => node.textContent.trim()); 
        }
        //console.log(selector)


        const htmlContent = await page.evaluate((selector) => {
          const element = document.querySelector(selector);
          let html = [element.innerHTML];
          return html;
        }, selector);
        for (let index = 0; index < htmlContent.length; index++) {          
          let redTexts = [];
          if(h2Text.includes(' 特殊') || h2Text.includes('行為者の特殊変化') ){
            // テキスト変数htmlContentから<font color="red">と</font>を取り除く
            const modifiedContent = htmlContent[index].replace(/<font color="red">/g, '').replace(/<\/font>/g, '').replace(/\(RV\)/g, ''); 
            // <br>で区切って配列に格納
            redTexts = modifiedContent.split('<br>');
          }else if(remark == '特殊変化(div)'){
            if(htmlContent[index].includes('<font color="red">')){
              // テキスト変数htmlContentから<font color="red">と</font>を取り除く
              const modifiedContent = htmlContent[index].replace(/<font color="red">/g, '').replace(/<\/font>/g, '').replace(/\(RV\)/g, ''); 
              // <br>で区切って配列に格納
              redTexts = modifiedContent.split('<br>');
            }
          }else if(includesAny){
            if(flg_unique == false || elementExists_yellow == true){
              if (htmlContent[index].includes('<font color="red">') && flg_alltext == false) {
                // `<font color="red">`が含まれる場合
                const regexPattern = />(.*?)</g;
                match_text = htmlContent[index].match(regexPattern)[0].replace(/</g, '').replace(/>/g, '');
                const matches = htmlContent[index].match(/<font color="red">(.*?)<\/font>/g);
                if (matches) {
                  if (matches.length >= 2) {
                    if(flg_stem == true){
                      for(let content of htmlContent[index].split('<br>')){
                        redTexts.push(content.replace('<font color="red">','').replace('</font>','').replace('pr','').replace('<br>',''));
                      }
                    }else{
                      // 一度目の<font color="red">と</font>の間にある文字列を抽出
                      const textBetweenFirstRed = matches[0].replace(/<\/font>/g, '').replace(/<font color="red">/g, '');
                      // </font>と<font color="red">の間にある文字列を抽出
                      const textBetweenFonts = htmlContent[index].match(/<\/font>(.*?)<font color="red">/)[1];
                      // 二度目の<font color="red">と</font>の間にある文字列を抽出
                      const secondTextBetweenReds = matches.length >= 2 ? matches[1].match(/<font color="red">(.*?)<\/font>/)[1] : '';
                      redTexts.push(textBetweenFirstRed + textBetweenFonts + secondTextBetweenReds); // 抽出された文字列を配列に追加
                    }
                  } else if (matches.length === 1) {
                    let n = root.length;
                    // 一度目の<font color="red">の前にある文字列を抽出
                    let firstCharBeforeRed = htmlContent[index].match(new RegExp(`.{0,${n}}(?=<font color="red">)`));
                    // 一度目の<font color="red">と</font>の間にある文字列を抽出
                    const textBetweenFirstRed = matches[0].replace(/<\/font>/g, '').replace(/<font color="red">/g, '');
                    const toptext = firstCharBeforeRed[0].charAt(0);
                    if(flg_unique == true && toptext != 'h'){
                      firstCharBeforeRed = 'h' + firstCharBeforeRed;
                    }
                    if(flg_stem = true){
                      let pushtext = htmlContent[index].replace('<font color="red">','').replace('</font>','').replace('<br>','');
                      if(url.includes('bm=ac3')){
                        if(elementExists_aqua){
                          redTexts.push(pushtext.replace('praty',''));
                          remark = '中語幹ac';
                        }else if(elementExists_yellow){
                          redTexts.push(pushtext.replace('praty',''));
                          remark = '強語幹añc';
                        }else{
                          redTexts.push(pushtext.replace('pratī',''));
                          remark = '弱語幹c';
                        }
                      }else if(elementExists_yellow){
                        redTexts.push('a' + pushtext.replace('prā',''));
                        remark = '強語幹añc';
                      }else{
                        redTexts.push('a' + pushtext.replace('prā',''));
                        remark = '中語幹ac';
                      }
                    }else{
                      redTexts.push(firstCharBeforeRed + textBetweenFirstRed); // 抽出された文字列を配列に追加
                    }
                  }
                }
              }else{
                const match = url.slice(-3).charAt(0);
                if(match.charAt(0) == '=' && match.includes('h')){
                  redTexts.push(htmlContent[index].slice(-1)); // 後ろから三文字を抽出して配列に追加
                }else{
                  let pushtext = htmlContent[index].slice(-(root.length));
                  if(flg_stem = true || flg_alltext == true){
                    if(pushtext.charAt(0) == 'ā'){
                      pushtext = pushtext.replace('ā','a');
                    }
                    if(url.includes('vis2vac') || url.includes('tiryac')){
                      pushtext = htmlContent[index].replace(/<font color="red">/g, '').replace(/<\/font>/g, '')
                    }
                    if(elementExists_aqua){
                      remark = '中語幹ac';
                    }else if(elementExists_yellow){
                      remark = '強語幹añc';
                    }else{
                      remark = '弱語幹c';
                    }
                  }
                  redTexts.push(pushtext); // 後ろから三文字を抽出して配列に追加
                }
              }
            }
          }else{
            if(htmlContent[index].includes('font')){
              // 正規表現パターンを使って`<font color="red">`と`</font>`の間の文字列を抽出
              const regexPattern = /<font color="red">(.*?)<\/font>/g;
              let match;
              while ((match = regexPattern.exec(htmlContent)) !== null) {
                redTexts.push(match[1]); // 抽出された文字列を配列に追加
              }
            }
          }

          if(!(flg_unique == true && elementExists_yellow == false)){
            
            let textCount = 0;
            for (let redText of redTexts){
              textCount++;
              if(textCount != 1){
                for(let directText of directTexts){
                  if(directText.includes('下段')){
                    remark = directText.replace(/※ 下段の形は/g, '').replace(/。/g, '').replace(/、/g, '')
                  }
                }
              }

              if (redText.includes('(')) {
                if(flg_stem){
                  for (let i = 0; i < 2; i++) {
                    data.push({
                      id: `${++counter_id}`,
                      case_or_voice: `${textInFirstColumn}`,
                      number: `${textInFirstRow}`,
                      word_class: `${wordClass}`,
                      root_or_mood: `${root}`,
                      ending_pattern: `${redText}`,
                      gender_or_person: gender,                    
                      remark: `${remark}`,
                      url: `${url}`
                    });
                  }
                }else{
                  const regexParentheses_insideParentheses = /\(([^()]+)\)/;
                  const insideParentheses = combinedText.match(regexParentheses_insideParentheses)[1];
                  const regexParentheses_beforeParentheses = /^([^()]+)\([^()]+\)/;
                  let beforeParentheses;
                  let beforeParentheses_alpha;
                  if(!redText.match(regexParentheses_beforeParentheses)){
                    beforeParentheses = '';
                    beforeParentheses_alpha = '';
                  }else{
                    beforeParentheses = combinedText.match(regexParentheses_beforeParentheses)[1]
                    beforeParentheses_alpha = beforeParentheses.slice(0, -insideParentheses.length);
                  }
                  const regexParentheses_afterParentheses = /\([^()]+\)([^()]+)/;
                  let afterParentheses;     
                  if(!redText.match(regexParentheses_afterParentheses)){
                    afterParentheses = '';
                  }else{
                    afterParentheses = combinedText.match(regexParentheses_afterParentheses)[1]
                  }
                  
                  for (let i = 0; i < 2; i++) {
                    data.push({
                      id: `${++counter_id}`,
                      case_or_voice: `${textInFirstColumn}`,
                      number: `${textInFirstRow}`,
                      word_class: `${wordClass}`,
                      root_or_mood: `${root}`,
                      ending_pattern: `${i === 0 ? beforeParentheses + afterParentheses : beforeParentheses_alpha + insideParentheses + afterParentheses}`,
                      gender_or_person: gender,                    
                      remark: `${remark}`,
                      url: `${url}`
                    });
                  }
                  modifyData(data);
                }
              }else if(gender == '男性女性'){
                for (let i = 0; i < 2; i++) {
                  if(i == 0){
                    gender = '男性'
                  }else{
                    gender = '女性'
                  }
                  data.push({
                    id: `${++counter_id}`,
                    case_or_voice: `${textInFirstColumn}`,
                    number: `${textInFirstRow}`,
                    word_class: `${wordClass}`,
                    root_or_mood: `${root}`,
                    ending_pattern: `${redText}`,
                    gender_or_person: gender,
                    remark: `${remark}`,
                    url: `${url}`
                  });
                  
                  modifyData(data);
                }
              }else{
                
                data.push({
                  id: `${++counter_id}`,
                  case_or_voice: `${textInFirstColumn}`,
                  number: `${textInFirstRow}`,
                  word_class: `${wordClass}`,
                  root_or_mood: `${root}`,
                  ending_pattern: `${redText}`,
                  gender_or_person: gender,
                  remark: `${remark}`,
                  url: `${url}`
                });
                modifyData(data);
              }
            }
          }
        }
      }
    }
  }

  await sleep(1000);
  await browser.close();
  return data;
}

async function scrapeAndWriteCSV() {
  const replacements = {
    'aa': 'ā',
    'ii': 'ī',
    'uu': 'ū',
    'am': 'ṃ',
    'n2': 'ñ', 
    'n3': 'ṇ',
    's3': 'ṣ',
    'pp1': '(',
    'pp2': ')',
    'pm': ',',
    'po': 'm',
    // Add other replacements here if needed
  };

  const urls = [
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=na&bm=am',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=na&bm=an',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=na&bm=aaf',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=na&bm=aa',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=na&bm=aia',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=na&bm=aian',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=na&bm=amn',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=na&bm=ann',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=na&bm=aafn',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=na&bm=aan',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=na&bm=ambaa',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=im',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=in',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=if',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=ia',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=iifm',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=iifs',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=imn',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=inn',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=ifn',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=ian',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=iifmn',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=pati',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=sakhi',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=laks3mii',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=strii',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nu&bm=um',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nu&bm=un',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nu&bm=uf',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nu&bm=ua',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nu&bm=uufm',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nu&bm=uufs',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nu&bm=umn',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nu&bm=unn',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nu&bm=ufn',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nu&bm=uan',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nu&bm=kros3t3u',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nr&bm=ra',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nr&bm=rmr',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nr&bm=rfr',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nr&bm=nr3',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nr&bm=rai',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nr&bm=nau',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nr&bm=go',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nr&bm=div',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=k',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=j',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=jt3',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=d',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=th',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=dh',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=dhh',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=bh',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=p',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=s2',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=s3',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=hh',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=ht3',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=ht',
  //////////////////////////////////////ここまで
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nc&bm=c',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nc&bm=ac2',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nc&bm=ac3',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nc&bm=tiryac',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nc&bm=vis2vac',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nt&bm=t',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nt&bm=at',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nt&bm=atd',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nt&bm=vat',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nt&bm=mahat',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nn&bm=an',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nn&bm=man2',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nn&bm=man2n',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nn&bm=in',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nn&bm=inn',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nn&bm=s2van',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nn&bm=yuvan',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nn&bm=maghavan',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ns&bm=s',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ns&bm=as',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ns&bm=is',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ns&bm=us',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ns&bm=r',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ns&bm=aas2is',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ns&bm=vas',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ns&bm=yas',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=np&bm=ahan',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=np&bm=ani',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=np&bm=anin',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=np&bm=path',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=np&bm=pum3s',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=np&bm=ap',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=np&bm=han',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=np&bm=anad3uh',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pron&bm=mad',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pron&bm=tvad',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pron&bm=tad',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pron&bm=idam',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pron&bm=adas',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pron&bm=yad',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pron&bm=kim',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pron&bm=bhavat',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pra&bm=a',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pra&bm=an',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pra&bm=b',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pra&bm=bn',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pra&bm=c',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pra&bm=cn',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pra&bm=ardha',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=num&bm=tb1',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=num&bm=tb2',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=num&bm=tb32',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=num&bm=tb32',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=num&bm=tb4',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=num&bm=c01',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=num&bm=c02',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=num&bm=c03',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=num&bm=c04',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=num&bm=c05',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=num&bm=c06',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=num&bm=c08',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=num&bm=o01',
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=num&bm=o02'
  ];


  let allData = [];
  for (let url of urls) {
    const data = await scrapeUrl(url, replacements);
    allData = [...allData, ...data];
  }

  // CSVファイルにデータを書き込む
  const csvData = allData.map(row => `${row.id},${row.word_class},${row.root_or_mood},${row.gender_or_person},${row.case_or_voice},${row.number},${row.ending_pattern},${row.remark},${row.url}`).join('\n');
  fs.writeFileSync('../../skt.csv', csvData);
  console.log('CSV data creation completed.');

/*   // SQLite3データベースにデータを書き込む
  const dbPath = '../../skt.db';
  if (fs.existsSync(dbPath)) {
    // ファイルが既に存在する場合は削除する
    fs.unlinkSync(dbPath);
    console.log('Existing database file deleted.');
  }
  const db = new sqlite3.Database(dbPath);
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS skt (
      id INTEGER PRIMARY KEY,
      word_class TEXT,
      root_or_mood TEXT,
      gender_or_person TEXT,
      case_or_voice TEXT,
      number TEXT,
      ending_pattern TEXT,
      url TEXT
    )`);

    const insertStmt = db.prepare(`INSERT INTO skt (word_class, root_or_mood, gender_or_person, case_or_voice, number, ending_pattern, url)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);

    allData.forEach(row => {
      insertStmt.run(row.word_class, row.root_or_mood, row.gender_or_person, row.case_or_voice, row.number, row.ending_pattern, row.url);
    });

    insertStmt.finalize();
  });

  db.close((err) => {
    if (err) {
      console.error('Error closing database connection:', err.message);
      return;
    }
    console.log('Database connection closed.');
  }); */

  console.log('Scraping and data creation completed.');
}
function modifyData(data) {
  const lastIndex = data.length - 1;
  if (data[lastIndex].gender_or_person == '形容詞') {
    data[lastIndex].gender_or_person = "中性";
  }
  if (data[lastIndex].case_or_voice == '従') {
    data[lastIndex].case_or_voice = "奪";
  }
}
scrapeAndWriteCSV();
