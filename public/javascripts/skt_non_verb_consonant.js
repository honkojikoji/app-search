const puppeteer = require('puppeteer');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const sleep = milliseconds =>
  new Promise(resolve =>
    setTimeout(resolve, milliseconds)
  );
let LastId;
const sktPath = '../../skt.db';
const sktdb = new sqlite3.Database(sktPath);
let counter_id
let data = [];

// 最後のid番号を取得して変数に代入する関数
function getLastId(callback) {
  const query = 'SELECT MAX(id) AS last_id FROM skt'; // テーブル名に適切な名前を指定する必要があります

  sktdb.serialize(() => {
    sktdb.get(query, (err, row) => {
      if (!err && row) {
        LastId = row.last_id; // LastId 変数に最後の id 番号を代入
        counter_id = LastId;
        console.log('LastId:', LastId); // 最後の id 番号をログに出力
        callback(); // コールバック関数を実行
      } else {
        console.error('Error fetching last id:', err); // エラーがあればログに出力
      }
    });
  });
}
// LastId の値が代入された後に実行する関数
function afterLastId() {
  scrapeAndWriteCSV(); // scrapeAndWriteCSV を実行
}
// getLastId 関数を呼び出して最後の id 番号を取得し、その後 afterLastId 関数を実行
getLastId(afterLastId);
async function scrapeUrl(url, replacements) {
  if(url == 'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nt&bm=vat'){
    data.push({
      id: `${++counter_id}`,
      case_or_voice: `主`,
      number: `単`,
      word_class: `名詞`,
      root_or_mood: `van`,
      ending_pattern: `vān`,
      gender_or_person: `男性`,    
      remark: `-vat`,
      url: `${url}`
    });
    modifyData(data);
    data.push({
      id: `${++counter_id}`,
      case_or_voice: `主`,
      number: `単`,
      word_class: `名詞`,
      root_or_mood: `man`,
      ending_pattern: `mān`,
      gender_or_person: `男性`,                    
      remark: `-mat`,
      url: `${url}`
    });
  }else{

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
  
    await page.goto(url, { waitUntil: 'networkidle0' });
  
    const h2Text = await page.$eval('h2', node => node.textContent.trim());
    let gender;  
    let wordClass = '名詞/形容詞';
  
    let tableCount = await page.$$eval('table', tables => tables.length);
    if(url == 'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nt&bm=at'){
      tableCount = 2;
    }
    for (let tableIndex = 0; tableIndex < tableCount; tableIndex++) {
      const regex = /-(.*?)(?: |(?=\())/g;
      const match = h2Text.match(regex);
      let root = '';
      if (match) {
        console.log(1,match)
        root = match[0].replace('-','').replace(' ','');
      }else{
        console.log(2)
        root = h2Text.replace('-','').replace('（語幹子音有気化）','');
      }
      if(url.includes('tb=pron')){
        let targetChar = "-";
        let index = h2Text.indexOf(targetChar);
        root = h2Text.substring(0, index);
      }
      if(url.includes('tb=pra')){
        root = 'a';
      }
      if(url.includes('tb=num')){
        if(url.includes('c05')){
          root = 'a';
        }else{
          let regex = /\((.*?)\)/; // 正規表現パターンで括弧内の文字列をマッチさせる
          let match = h2Text.match(regex); // マッチした部分を取得
          if (match) {
           let extractedText = match[1]; // グループ化された部分 (括弧内の文字列) を取得
           root = extractedText.replace('-','');
          } 
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
      } else if(tdCount == 9){
        columns = [2, 3, 5, 6, 8, 9];
      }
  
      let startRow = (tableCount > 1 && tableIndex > 0) ? 3 : 4;
      if(url == 'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nn&bm=yuvan'){
        startRow = 4;
      }
      if(tdCount == 4 || tdCount == 2){
        startRow = 3;
      }

      let endRow;
      endRow = 8 + startRow;
      if(url.includes('tb=pron') && tableCount == 2){
        endRow = endRow - 1;
      }
      if(url.includes('tb=pra')){
        endRow = endRow - 1;
      }
      for (let row = startRow; row < endRow; row++) {
        for (let column of columns) {
          let remark = '';        
          if(tableCount > 1){
            if(tableIndex == 0 && column < 5){
              gender = '男性';
            }else if(tableIndex == 0 && column > 5){
              gender = '中性';
            }else {
              gender = '女性';
            }
          }else{
            if(column < 5){
              gender = '男性女性';
              if(tdCount == 4){
                gender = '女性';
              }
            }else{
              gender = '中性';
            }
          }
          const selector = `table:nth-child(${tableIndex + 2}) > tbody > tr:nth-child(${row}) > td:nth-child(${column})`;
          
          const elementExists_yellow = await page.evaluate((selector) => {
            const element = document.querySelector(selector);
            
            return element ? element.getAttribute('bgcolor') === 'yellow' : false;
          }, selector);
          const elementExists_aqua = await page.evaluate((selector) => {
            const element = document.querySelector(selector);
            
            return element ? element.getAttribute('bgcolor') === 'aqua' : false;
          }, selector);
          const case_pattern = await page.$eval(`table:nth-child(${tableIndex + 2}) > tbody > tr:nth-child(${row}) > td:nth-child(1)`, node => node.textContent.trim());
          let number = await page.$eval(`table:nth-child(${tableIndex + 2}) > tbody > tr:nth-child(${startRow - 1}) > td:nth-child(${column})`, node => node.textContent.trim()); 
  
          const htmlContent = await page.evaluate((selector) => {
            const element = document.querySelector(selector);
            let html = [element.innerHTML];
            return html;
          }, selector);
          for (let index = 0; index < htmlContent.length; index++) {          
            let pushTexts = [];
            // テキスト変数htmlContentから<font color="red">と</font>を取り除く
            const modifiedContent = htmlContent[index].replace(/<font color="red">/g, '').replace(/<\/font>/g, ''); 
            // <br>で区切って配列に格納
            const modifiedTexts = modifiedContent.split('<br>');
            for (let modifiedText of modifiedTexts){
              if(url.includes('bm=man')){
                root = 'man';
              }
              if(url == 'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nn&bm=s2van'){
                root = 'śvan';
              }else if(url == 'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nn&bm=yuvan'){
                root = 'yuvan';
              }else if(url == 'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nn&bm=maghavan'){
                root = 'maghavan';
              }else if(url == 'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ns&bm=aas2is'){
                root = 'āśis';
              }else if(url == 'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ns&bm=yas'){
                root = 'yas';
              }else if(url == 'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=np&bm=anad3uh'){
                root = 'anaḍuh';
              }else if(url.includes('tb=np&bm=an')){
                root = 'an';
              }
              if(root == 'h'){
                if(modifiedText.includes('dhu')){
                  modifiedText = modifiedText.replace('dhu','');
                }else if(modifiedText.includes('duh')){
                  modifiedText = modifiedText.replace('duh','');
                }
              }  
              let lastIndex;
              // 'k' の位置を特定するために、後ろから1番目の 'k' のインデックスを見つける
              lastIndex = modifiedText.lastIndexOf(root);
              if(root == 'ac'){
                if(modifiedText.includes('prāñ')){
                  lastIndex = modifiedText.lastIndexOf('añc');
                }else if(modifiedText.includes('prā')){
                  lastIndex = modifiedText.lastIndexOf('ac');
                }
                if(modifiedText.includes('pratyañ')){
                  lastIndex = modifiedText.lastIndexOf('añc');
                }else if(modifiedText.includes('pratya')){
                  lastIndex = modifiedText.lastIndexOf('ac');
                }else if(modifiedText.includes('pratī')){
                  lastIndex = modifiedText.lastIndexOf('c');
                }
                if(url.includes('ac2')){
                  if(modifiedText.includes('ā')){
                    modifiedText = modifiedText.replace('ā', 'aa');;
                    console.log(modifiedText)
                  }
                }
              }else if(root == 'at'){
                if(url == 'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nt&bm=at'){
                  remark = '現在/未来分詞。';
                  if(modifiedText.includes('tudan')){
                    lastIndex = modifiedText.lastIndexOf('ant');
                  }else if(modifiedText.includes('tuda')){
                    lastIndex = modifiedText.lastIndexOf('at');
                  }
                }else if(url == 'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nt&bm=atd'){
                  remark = '第三類動詞の分詞。語根を重複させて作る。';
                  if(modifiedText.includes('dadan')){
                    lastIndex = modifiedText.lastIndexOf('ant');
  
                  }else if(modifiedText.includes('dada')){
                    lastIndex = modifiedText.lastIndexOf('at');
                    console.log(lastIndex,modifiedText)
                  }else{
                  }
                }
              }
              if(modifiedText.includes('ṅ')){
                const target = root.slice(0, -1);
                lastIndex = modifiedText.lastIndexOf(target + 'ṅ');
              }
              if(modifiedText.includes('ñ')){
                const target = root.slice(0, -1);
                lastIndex = modifiedText.lastIndexOf(target + 'ñ');
              }
              if(modifiedText.includes('n')){
                const target = root.slice(0, -1);
                const array_n = ['d','th','dh','t','at'];
                // 少なくとも一つ以上の要素を含むかどうかを判定
                const includesAny = array_n.some(element => root.includes(element));
                if(includesAny){
                  if(!modifiedText.includes('nām')){
                    lastIndex = modifiedText.lastIndexOf(target + 'n');
                  }
                }
              }
              if(modifiedText.includes('m') && !modifiedText.endsWith('m')){
                const array_m = ['bh','p'];
                // 少なくとも一つ以上の要素を含むかどうかを判定
                const includesAny = array_m.some(element => root.includes(element));
                if(includesAny){
                  lastIndex = modifiedText.lastIndexOf('m');
                }
              }
              if(modifiedText.includes('ṃ') && !modifiedText.endsWith('ṃ')){
                const array_m = ['ś','ṣ','h','s'];
                // 少なくとも一つ以上の要素を含むかどうかを判定
                const includesAny = array_m.some(element => root.includes(element));
                if(includesAny){
                  lastIndex = modifiedText.lastIndexOf('ṃ');
                }
              }
              if(root == 'tiryac'){
                wordClass = '形容詞'
                remark = '特殊変化(tiryac)';
                if(modifiedText.includes('k')){
                  remark = remark + '-cは絶対語尾規則により-k';
                }else if(modifiedText.includes('g')){
                  remark = remark + '-cは絶対語尾規則により-kとなり、有声子音語尾の前ではgとなる。';
                }
                pushTexts.push(modifiedText);
              }else if(root == 'viśvac'){
                wordClass = '形容詞'
                remark = '特殊変化(viśvac)';
                if(modifiedText.includes('k')){
                  remark = remark + '-cは絶対語尾規則により-k';
                }else if(modifiedText.includes('g')){
                  remark = remark + '-cは絶対語尾規則により-kとなり、有声子音語尾の前ではgとなる。';
                }
                pushTexts.push(modifiedText);
              }else if(root == 'mahat'){
                wordClass = '形容詞'
                remark = '特殊変化(mahat)';
                pushTexts.push(modifiedText);
              }else if(root == 'śvan'){
                wordClass = '名詞'
                gender = '男性';
                remark = '特殊変化(śvan)弱語幹がśvn-でなくśun-';
                pushTexts.push(modifiedText);
              }else if(root == 'yuvan'){
                remark = '特殊変化(yuvan)弱語幹がyūvn-でなくyūn-';
                if(tableIndex == 1){
                  if(column < 5){
                    remark += '(yuvatī-型)'
                  }else{
                    remark += '(yuvati-型)'
                  }
                }
                pushTexts.push(modifiedText);
              }else if(root == 'maghavan'){
                remark = '特殊変化(maghavan)弱語幹がmaghavn-でなくmaghon-';
                pushTexts.push(modifiedText);
              }else if(root == 'at'){
                if(modifiedText.substring(lastIndex).includes('(n)')){
                  pushTexts.push(modifiedText.substring(lastIndex).replace('tud',''));
                }else if(modifiedText.substring(lastIndex).includes('tudad')){
                  pushTexts.push(modifiedText.substring(lastIndex).replace('tud',''));
                  remark = remark + '-tは絶対語尾でも-t、有声音化すると-d';
                }else if(modifiedText.substring(lastIndex).includes('dadad')){
                  pushTexts.push(modifiedText.substring(lastIndex).replace('dad',''));
                  remark = remark + '-tは絶対語尾でも-t、有声音化すると-d';
                }else{
                  pushTexts.push(modifiedText.substring(lastIndex));
                }
              }else if(root == 'an'){
                if(url.includes('tb=np&bm=an')){
                  gender = '中性';
                  wordClass = '名詞';
                  if(modifiedText.includes('asth')){
                    remark = '-i混在型';
                    pushTexts.push(modifiedText.replace('asth',''));
                  }else if(modifiedText.includes('akṣ')){
                    remark = '-i混在型(語幹内のṛ/ṝ/r/ṣの影響により、 語尾内のnがṇとなるもの)';
                    pushTexts.push(modifiedText.replace('akṣ',''));
                  }
                }else{
                  pushTexts.push(modifiedText.replace('rāj','').replace('nām','').replace('ñ','n'));
                }
              }else if(root == 'man'){
                if(modifiedText.includes('āt')){
                  gender = '男性';
                }else{                  
                  gender = '中性';
                }
                if((!modifiedText.includes('brah') || modifiedText.includes('ṇ')) && !modifiedText.includes('&nbsp;')){
                  console.log(!modifiedText.includes('brah'), modifiedText.includes('ṇ'), modifiedText)
                  pushTexts.push(modifiedText.replace('āt','').replace('veś','').replace('brah',''));
                  pushTexts.push(modifiedText.replace('āt','').replace('veś','').replace('brah','').replace('m','v'));
                  if(modifiedText.includes('ṇ')){
                    remark = '語幹内のṛ/ṝ/r/ṣの影響により、 語幹末尾のnがṇとなるもの';
                  }
                }
              }else if(root == 'in'){
                if((!modifiedText.includes('pakṣ') || modifiedText.includes('ṇ')) && !modifiedText.includes('&nbsp;')){
                  pushTexts.push(modifiedText.replace('bal','').replace('pakṣ',''));
                  if(modifiedText.includes('ṇ')){
                    gender = '男性';
                    remark = '語幹内のṛ/ṝ/r/ṣの影響により、 語幹末尾のnがṇとなるもの';
                  }
                }
              }else if(root == 's'){
                pushTexts.push(modifiedText.replace('do',''));
              }else if(root == 'as'){
                pushTexts.push(modifiedText.replace('suman',''));
              }else if(root == 'is'){
                pushTexts.push(modifiedText.replace('jyot',''));
              }else if(root == 'us'){
                pushTexts.push(modifiedText.replace('ghāy',''));
              }else if(root == 'r'){
                if(modifiedText.includes('gī')){
                  remark = '子音語尾では母音が長くなる。';
                  pushTexts.push(modifiedText.replace('gī',''));
                }else{
                  pushTexts.push(modifiedText.replace('gi','').replace('vā',''));
                }
              }else if(root == 'āśis'){
                gender = '女性';
                wordClass = '名詞';
                if(modifiedText.includes('āśī')){
                  remark = '特殊変化(āśis)子音語尾では母音が長くなる。';
                  pushTexts.push(modifiedText);
                }else{
                  remark = ('特殊変化(āśis)');
                  pushTexts.push(modifiedText);
                }
              }else if(root == 'vas'){
                pushTexts.push(modifiedText.replace('vid',''));
              }else if(root == 'yas'){
                pushTexts.push(modifiedText.replace('śre',''));
              }else if(root == 'path'){
                wordClass = '名詞';
                gender = '男性';
                remark = '特殊変化(path)';
                pushTexts.push(modifiedText);
              }else if(root == 'puṃs'){
                wordClass = '名詞';
                gender = '男性';
                remark = '特殊変化(puṃs)';
                pushTexts.push(modifiedText);
              }else if(root == 'ap'){
                if(!modifiedText.includes('&nbsp;')){
                  wordClass = '名詞';
                  gender = '女性';
                  remark = '特殊変化(ap)';                
                  pushTexts.push(modifiedText);
                }
              }else if(root == 'han'){
                wordClass = '形容詞';
                remark = '特殊変化(han)';
                pushTexts.push(modifiedText);
              }else if(root == 'anaḍuh'){
                wordClass = '名詞';
                gender = '男性';
                remark = '特殊変化(anaḍuh)';
                pushTexts.push(modifiedText);
              }else if(url.includes('tb=pron')){
                if(!modifiedText.includes('&nbsp;')){
                  wordClass = '代名詞';
                  gender = '';
                  if(modifiedText.includes('(')){
                    let targetChar = "(";
                    let index = modifiedText.indexOf(targetChar);
                    let substring = modifiedText.substring(0, index);
                    if(substring){
                      pushTexts.push(substring);
                    }
                    pushTexts.push(modifiedText.replace(substring,'').replace('(','').replace(')',''));
                  }else{
                    pushTexts.push(modifiedText);
                  }
                }
              }else if(url.includes('tb=pra')){
                if(!modifiedText.includes('&nbsp;')){
                  wordClass = '形容詞';
                  if(elementExists_yellow){
                    remark = '代名詞的に変化'
                    pushTexts.push(modifiedText.replace('any','').replace('itar',''));
                  }
                }
              }else if(url.includes('tb=num')){
                wordClass = '数詞';
                if(root != 'eka'){
                  gender = '全性'
                  if(root == 'dvi'){
                    number = '両';
                  }else{
                    number = '複';
                  }
                }
                if(root == 'a'){
                  pushTexts.push(modifiedText.replace('pañc',''));
                }else{
                  pushTexts.push(modifiedText);
                }
              }else if (lastIndex !== -1) {
                const array_dup = ['t3','bm=ht'];
                // 少なくとも一つ以上の要素を含むかどうかを判定
                const includesAny = array_dup.some(element => url.includes(element));
                if(!includesAny){
                  pushTexts.push(modifiedText.substring(lastIndex));
                }
              }else{
                console.log(modifiedText)
                if(root == 'k'){
                  const lastIndex = modifiedText.lastIndexOf('g');
                  if (lastIndex !== -1) {
                    pushTexts.push(modifiedText.substring(lastIndex));
                    remark = '-kは有声音化すると-g';
                  }else{
                    console.log('error:要修正1');
                    pushTexts.push(modifiedText);
                  }
                }else if(root == 'j'){
                  if(modifiedText == '{samraat3'){
                    modifiedText = 'samrāṭ';
                  }
                  let lastIndex = modifiedText.lastIndexOf('k');
                  if (lastIndex !== -1) {
                    pushTexts.push(modifiedText.substring(lastIndex));
                    remark = '-jは絶対語尾で-k';
                  }else{
                    const lastIndex = modifiedText.lastIndexOf('g');
                    if (lastIndex !== -1) {
                      pushTexts.push(modifiedText.substring(lastIndex));
                      remark = '-jは絶対語尾で-k、有声音化すると-g';
                    }
                  }
                  lastIndex = modifiedText.lastIndexOf('ṭ');
                  if (lastIndex !== -1) {
                    pushTexts.push(modifiedText.substring(lastIndex));
                    remark = '-jが絶対語尾で-kでなく-ṭとなるもの';
                  }else{
                    const lastIndex = modifiedText.lastIndexOf('ḍ');
                    if (lastIndex !== -1) {
                      pushTexts.push(modifiedText.substring(lastIndex));
                      remark = '-jが絶対語尾で-kでなく-ṭ、有声音化して-ḍとなるもの';
                    }
                  }
                }else if(root == 'd'){
                  const lastIndex = modifiedText.lastIndexOf('t');
                  if (lastIndex !== -1) {
                    pushTexts.push(modifiedText.substring(lastIndex));
                    remark = remark + '-dは絶対語尾で-t';
                  }else{
                    console.log('error:要修正1',modifiedText);
                    pushTexts.push(modifiedText);
                  }
                }else if(root == 'th'){
                  const lastIndex = modifiedText.lastIndexOf('t');
                  if (lastIndex !== -1) {
                    pushTexts.push(modifiedText.substring(lastIndex));
                    remark = '-thは絶対語尾で-t';
                  }else{
                    const lastIndex = modifiedText.lastIndexOf('d');
                    if (lastIndex !== -1) {
                      pushTexts.push(modifiedText.substring(lastIndex));
                      remark = '-thは絶対語尾で-t、有声音化すると-d';
                    }
                  }
                }else if(root == 'dh'){
                  const lastIndex = modifiedText.lastIndexOf('t');
                  if (lastIndex !== -1) {
                    pushTexts.push(modifiedText.substring(lastIndex));
                    remark = '-dhは絶対語尾で-t、副作用で語幹の頭のg/d/bがgh/dh/bhになる';
                  }else{
                    const lastIndex = modifiedText.lastIndexOf('d');
                    if (lastIndex !== -1) {
                      pushTexts.push(modifiedText.substring(lastIndex));
                      remark = '-dhは絶対語尾で-t、有声音化すると-d、副作用で語幹の頭のg/d/bがgh/dh/bhになる';
                    }
                  }
                }else if(root == 'bh'){
                  const lastIndex = modifiedText.lastIndexOf('p');
                  if (lastIndex !== -1) {
                    pushTexts.push(modifiedText.substring(lastIndex));
                    remark = '-bhは絶対語尾で-p';
                  }else{
                    const lastIndex = modifiedText.lastIndexOf('b');
                    if (lastIndex !== -1) {
                      pushTexts.push(modifiedText.substring(lastIndex));
                      remark = '-bhは絶対語尾で-p、有声音化すると-b';
                    }
                  }
                }else if(root == 'p'){
                  const lastIndex = modifiedText.lastIndexOf('b');
                  if (lastIndex !== -1) {
                    pushTexts.push(modifiedText.substring(lastIndex));
                    remark = '-pは有声音化すると-b';
                  }else{
                    console.log('error:要修正1');
                    pushTexts.push(modifiedText);
                  }
                }else if(root == 'ś'){
                  const lastIndex = modifiedText.lastIndexOf('k');
                  if (lastIndex !== -1) {
                    pushTexts.push(modifiedText.substring(lastIndex));
                    remark = '-śは絶対語尾で-k';
                  }else{
                    const lastIndex = modifiedText.lastIndexOf('g');
                    if (lastIndex !== -1) {
                      pushTexts.push(modifiedText.substring(lastIndex));
                      remark = '-śは絶対語尾で-k、有声音化すると-g';
                    }
                  }
                }else if(root == 'ṣ'){
                  const lastIndex = modifiedText.lastIndexOf('ṭ');
                  if (lastIndex !== -1) {
                    pushTexts.push(modifiedText.substring(lastIndex));
                    remark = '-ṣは絶対語尾で-ṭ';
                  }else{
                    const lastIndex = modifiedText.lastIndexOf('ḍ');
                    if (lastIndex !== -1) {
                      pushTexts.push(modifiedText.substring(lastIndex));
                      remark = '-ṣは絶対語尾で-ṭ、有声音化すると-ḍ';
                    }
                  }
                }else if(root == 'h'){
                  let lastIndex = modifiedText.lastIndexOf('k');
                  if (lastIndex !== -1) {
                    pushTexts.push(modifiedText.substring(lastIndex));
                    remark = '-hは絶対語尾で-k、副作用で語幹の頭のg/d/bがgh/dh/bhになる';
                  }else{
                    const lastIndex = modifiedText.lastIndexOf('g');
                    if (lastIndex !== -1) {
                      pushTexts.push(modifiedText.substring(lastIndex));
                      remark = '-hは絶対語尾で-k、有声音化すると-g、副作用で語幹の頭のg/d/bがgh/dh/bhになる';
                    }
                  }
                  lastIndex = modifiedText.lastIndexOf('ṭ');
                  if (lastIndex !== -1) {
                    pushTexts.push(modifiedText.substring(lastIndex));
                    remark = '-hが絶対語尾で-kでなく-ṭとなるもの';
                  }else{
                    const lastIndex = modifiedText.lastIndexOf('ḍ');
                    if (lastIndex !== -1) {
                      pushTexts.push(modifiedText.substring(lastIndex));
                      remark = '-hが絶対語尾で-kでなく-ṭ、有声音化して-ḍとなるもの';
                    }
                  }
                  lastIndex = modifiedText.lastIndexOf('t');
                  if (lastIndex !== -1) {
                    pushTexts.push(modifiedText.substring(lastIndex));
                    remark = '-hが絶対語尾で-kでなく-tとなるもの';
                  }else{
                    const lastIndex = modifiedText.lastIndexOf('d');
                    if (lastIndex !== -1) {
                      pushTexts.push(modifiedText.substring(lastIndex));
                      remark = '-hが絶対語尾で-kでなく-t、有声音化して-dとなるもの';
                    }
                  }
                }else if(root == 'c'){
                  const lastIndex = modifiedText.lastIndexOf('k');
                  if (lastIndex !== -1) {
                    pushTexts.push(modifiedText.substring(lastIndex));
                    remark = '-cは絶対語尾で-k';
                  }else{
                    const lastIndex = modifiedText.lastIndexOf('g');
                    if (lastIndex !== -1) {
                      pushTexts.push(modifiedText.substring(lastIndex));
                      remark = '-cは絶対語尾で-k、有声音化すると-g';
                    }
                  }
                }else if(root == 'ac'){
                  const lastIndex = modifiedText.lastIndexOf('ak');
                  if (lastIndex !== -1) {
                    pushTexts.push(modifiedText.substring(lastIndex));
                    remark = '-cは絶対語尾で-k';
                  }else{
                    const lastIndex = modifiedText.lastIndexOf('ag');
                    if (lastIndex !== -1) {
                      pushTexts.push(modifiedText.substring(lastIndex));
                      remark = '-cは絶対語尾で-k、有声音化すると-g';
                    }
                  }
                }else if(root == 't'){
                  const lastIndex = modifiedText.lastIndexOf('d');
                  if (lastIndex !== -1) {
                    pushTexts.push(modifiedText.substring(lastIndex));
                    remark = '-tは絶対語尾でも-t、有声音化すると-d';
                  }else{
                    console.log('error:要修正1',modifiedText);
                    pushTexts.push(modifiedText);
                  }
                }else{
                  console.log('error:要修正2',modifiedText,lastIndex);
                  pushTexts.push(modifiedText);
                }
              }
            }
            for (let pushText of pushTexts){
              let wordClasses;
              if(wordClass == '名詞/形容詞'){
                wordClasses = ['名詞' ,'形容詞'];/* ,'形容詞' */
              }else{
                wordClasses = [wordClass];
              }
              for(let wordClass of wordClasses){
                console.log(counter_id,pushText,gender)
                if(pushText.includes('aṣṭ')){
                  gender = '全性';
                  console.log('aṣṭ',url)
                }
                if (pushText.includes('(')) {                
                  for (let i = 0; i < 2; i++) {
                    let ending_pattern;                
                    if(root == 'at'){
                      if(i == 0){
                        ending_pattern = pushText.replace('(','').replace(')','');
                        remark = remark + '1/4/10類。第二次活用。(2(-ā)/6類。未来分詞)';
                      }else{
                        ending_pattern = pushText.replace('(n)','')   
                        remark = remark.replace('1/4/10類。第二次活用。(2(-ā)/6類。未来分詞)','') + '2(-ā以外)/3/5/7/8/9類。(2(-ā)/6類。未来分詞)';
                      }
                    }
                    data.push({
                      id: `${++counter_id}`,
                      case_or_voice: `${case_pattern}`,
                      number: `${number}`,
                      word_class: `${wordClass}`,
                      root_or_mood: `${root}`,
                      ending_pattern: `${ending_pattern}`,
                      gender_or_person: gender,                    
                      remark: `${remark}`,
                      url: `${url}`
                    });
                  }
                  modifyData(data);
                
              }else if(gender == '男性女性'){
                let gender;
                for (let i = 0; i < 2; i++) {
                  if(i == 0){
                    gender = '男性'
                  }else{
                    gender = '女性'
                  }
                  data.push({
                    id: `${++counter_id}`,
                    case_or_voice: `${case_pattern}`,
                    number: `${number}`,
                    word_class: `${wordClass}`,
                    root_or_mood: `${root}`,
                    ending_pattern: `${pushText}`,
                    gender_or_person: gender,
                    remark: `${remark}`,
                    url: `${url}`
                  });
                  
                  modifyData(data);
                }
              }else if(gender == '全性'){
                let gender;
                for (let i = 0; i < 3; i++) {
                  if(i == 0){
                    gender = '男性'
                  }else if(i == 1){
                    gender = '中性'
                  }else{
                    gender = '女性'
                  }
                  data.push({
                    id: `${++counter_id}`,
                    case_or_voice: `${case_pattern}`,
                    number: `${number}`,
                    word_class: `${wordClass}`,
                    root_or_mood: `${root}`,
                    ending_pattern: `${pushText}`,
                    gender_or_person: gender,
                    remark: `${remark}`,
                    url: `${url}`
                  });
                  
                  modifyData(data);
                }
              }else{                
                data.push({
                  id: `${++counter_id}`,
                  case_or_voice: `${case_pattern}`,
                  number: `${number}`,
                  word_class: `${wordClass}`,
                  root_or_mood: `${root}`,
                  ending_pattern: `${pushText}`,
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

    if(url == 'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nn&bm=an'){
      data.push({
        id: `${++counter_id}`,
        case_or_voice: `主`,
        number: `単`,
        word_class: `形容詞`,
        root_or_mood: `pīvan`,
        ending_pattern: `pīvān`,
        gender_or_person: `男性`,    
        remark: `特殊変化(pīvan)`,
        url: `${url}`
      });
      modifyData(data);
    }
    await sleep(1000);
    await browser.close();

  }
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
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=k',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=j',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=jt3',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=d',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=th',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=dhh',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=bh',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=p',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=s2',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=s3',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=hh',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=ht3',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nj&bm=ht',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nc&bm=c',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nc&bm=ac2',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nc&bm=ac3',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nc&bm=tiryac',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nc&bm=vis2vac',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nt&bm=t',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nt&bm=at',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nt&bm=atd',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nt&bm=vat',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nt&bm=mahat',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nn&bm=an',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nn&bm=man2',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nn&bm=man2n',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nn&bm=in',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nn&bm=inn',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nn&bm=s2van',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nn&bm=yuvan',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nn&bm=maghavan',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ns&bm=s',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ns&bm=as',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ns&bm=is',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ns&bm=us',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ns&bm=r',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ns&bm=aas2is',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ns&bm=vas',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=ns&bm=yas',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=np&bm=ahan',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=np&bm=ani',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=np&bm=anin',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=np&bm=path',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=np&bm=pum3s',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=np&bm=ap',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=np&bm=han',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=np&bm=anad3uh',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pron&bm=mad',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pron&bm=tvad',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pron&bm=tad',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pron&bm=idam',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pron&bm=adas',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pron&bm=yad',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pron&bm=kim',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pron&bm=bhavat',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pra&bm=a',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=pra&bm=an',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=num&bm=c01',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=num&bm=c02',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=num&bm=c03',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=num&bm=c04',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=num&bm=c05',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=num&bm=c06',
  'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=num&bm=c08'
  ];


  let allData = [];
  for (let url of urls) {
    const newdata = await scrapeUrl(url, replacements);
    allData = [...allData, ...newdata];
  }

   // CSVファイルにデータを書き込む
   const csvData = allData.map(row => `${row.id},${row.word_class},${row.case_or_voice},${row.root_or_mood},${row.gender_or_person},${row.number},${row.ending_pattern},${row.remark},${row.url}`).join('\n');
   fs.appendFileSync('../../skt.csv', csvData);
   console.log('CSV data appended.');
 
  // SQLite3データベースにデータを書き込む
  const dbPath = '../../skt.db';
  const db = new sqlite3.Database(dbPath);
  db.serialize(() => {
    const stmt = db.prepare(`INSERT INTO skt (id, word_class, root_or_mood, gender_or_person, case_or_voice, number, ending_pattern, remark, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    data.forEach(row => {
      stmt.run(row.id, row.word_class, row.root_or_mood, row.gender_or_person, row.case_or_voice, row.number, row.ending_pattern, row.remark, row.url);
    });
    stmt.finalize();
    console.log('Data appended to SQLite database.');
  });

  db.close((err) => {
    if (err) {
      console.error('Error closing database connection:', err.message);
      return;
    }
    console.log('Database connection closed.');
  });

  console.log('Scraping and data creation completed.');
}
function modifyData(data) {
  const lastIndex = data.length - 1;
  if (data[lastIndex].case_or_voice == '従') {
    data[lastIndex].case_or_voice = "奪";
  }
}