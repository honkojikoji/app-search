const puppeteer = require('puppeteer');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const sleep = milliseconds =>
  new Promise(resolve =>
    setTimeout(resolve, milliseconds)
  );
let counter_id = 0; // counter_id変数を定義

async function scrapeUrl(url) {

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
    
    
    let endRow;
    endRow = 8 + startRow;

    for (let row = startRow; row < endRow; row++) {
      for (let column of columns) {

        let remark = '';
        let flg_unique = false;
        if(h2Text.includes('特殊')){
          flg_unique = true;
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
              
              }else if(gender == '男性女性'){
                console.log('男性女性',url)
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
    // Add other replacements here if needed
  };

  const urls = [
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=na&bm=am',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=na&bm=an',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=na&bm=aaf',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=na&bm=aa',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=na&bm=aia',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=na&bm=aian',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=na&bm=amn',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=na&bm=ann',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=na&bm=aafn',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=na&bm=aan',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=na&bm=ambaa',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=im',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=in',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=if',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=ia',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=iifm',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=iifs',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=imn',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=inn',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=ifn',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=ian',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=iifmn',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=pati',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=sakhi',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=laks3mii',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ni&bm=strii',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nu&bm=um',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nu&bm=un',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nu&bm=uf',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nu&bm=ua',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nu&bm=uufm',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nu&bm=uufs',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nu&bm=umn',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nu&bm=unn',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nu&bm=ufn',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nu&bm=uan',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nu&bm=kros3t3u',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nr&bm=ra',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nr&bm=rmr',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nr&bm=rfr',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nr&bm=nr3',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nr&bm=rai',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nr&bm=nau',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nr&bm=go',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nr&bm=div',
  ];


  let allData = [];
  for (let url of urls) {
    const data = await scrapeUrl(url, replacements);
    allData = [...allData, ...data];
  }
  
  // SQLite3データベースにデータを書き込む
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
      remark TEXT,
      url TEXT
    )`);

    const insertStmt = db.prepare(`INSERT INTO skt (word_class, root_or_mood, gender_or_person, case_or_voice, number, ending_pattern, remark, url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

    allData.forEach(row => {
      insertStmt.run(row.word_class, row.root_or_mood, row.gender_or_person, row.case_or_voice, row.number, row.ending_pattern, row.remark, row.url);
    });

    insertStmt.finalize();
  });

  db.close((err) => {
    if (err) {
      console.error('Error closing database connection:', err.message);
      return;
    }
    console.log('Database connection closed.');
  });
  // CSVファイルにデータを書き込む
  const csvData = allData.map(row => `${row.id},${row.word_class},${row.case_or_voice},${row.root_or_mood},${row.gender_or_person},${row.number},${row.ending_pattern},${row.remark},${row.url}`).join('\n');
  fs.writeFileSync('../../skt.csv', csvData);
  console.log('CSV data creation completed.');
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
