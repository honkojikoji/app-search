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
  let gender;  
  let wordClass = '名詞';


  const data = [];
  let tableCount = await page.$$eval('table', tables => tables.length);

  for (let tableIndex = 0; tableIndex < tableCount; tableIndex++) {
    const regex = /-(.*?)(?: |(?=\())/g;
    const match = h2Text.match(regex);
    let root = '';
    if (match) {
      console.log(1,match)
      root = match[0].replace('-','').replace(' ','');
    }else{
      console.log(2)
      root = h2Text.replace('-','');
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

    let startRow = (tableCount > 1 && tableIndex > 0) ? 3 : 4;
    let endRow;
    endRow = 8 + startRow;

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
          }else{
            gender = '中性';
          }
        }

        const selector = `table:nth-child(${tableIndex + 2}) > tbody > tr:nth-child(${row}) > td:nth-child(${column})`;
 
        const elementExists_yellow = await page.evaluate((selector) => {
          const element = document.querySelector(selector);
          
          return element ? element.getAttribute('bgcolor') === 'aqua' : false;
        }, selector);
        const elementExists_aqua = await page.evaluate((selector) => {
          const element = document.querySelector(selector);
          
          return element ? element.getAttribute('bgcolor') === 'aqua' : false;
        }, selector);
        
        const case_pattern = await page.$eval(`table:nth-child(${tableIndex + 2}) > tbody > tr:nth-child(${row}) > td:nth-child(1)`, node => node.textContent.trim());
        const number = await page.$eval(`table:nth-child(${tableIndex + 2}) > tbody > tr:nth-child(${startRow - 1}) > td:nth-child(${column})`, node => node.textContent.trim()); 

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
            let lastIndex;
            // 'k' の位置を特定するために、後ろから2番目の 'k' のインデックスを見つける
            if(modifiedText.includes('ṅ')){
              lastIndex = modifiedText.lastIndexOf('ṅ');
            }else if(modifiedText.includes('ñ')){
              lastIndex = modifiedText.lastIndexOf('ñ');
            }else if(modifiedText.includes('n')){
              lastIndex = modifiedText.lastIndexOf('n');
            }else{
              lastIndex = modifiedText.lastIndexOf(root);
            }
            if (lastIndex !== -1) {
              pushTexts.push(modifiedText.substring(lastIndex));
            }else{
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
                    remark = ' -jが絶対語尾で-kでなく-ṭ、有声音化して-ḍとなるもの';
                  }else{
                    console.log('error:要修正1',modifiedText,root);
                  }
                }
              }else if(root == 'd'){
                const lastIndex = modifiedText.lastIndexOf('t');
                if (lastIndex !== -1) {
                  pushTexts.push(modifiedText.substring(lastIndex));
                  remark = '-dは絶対語尾で-t';
                }else{
                  console.log('error:要修正1');
                  pushTexts.push(modifiedText);
                }
              }else{
                console.log('error:要修正2');
                pushTexts.push(modifiedText);
              }
            }
          }
          for (let pushText of pushTexts){
            if (pushText.includes('(')) {
                const regexParentheses_insideParentheses = /\(([^()]+)\)/;
                const insideParentheses = combinedText.match(regexParentheses_insideParentheses)[1];
                const regexParentheses_beforeParentheses = /^([^()]+)\([^()]+\)/;
                let beforeParentheses;
                let beforeParentheses_alpha;
                if(!pushText.match(regexParentheses_beforeParentheses)){
                  beforeParentheses = '';
                  beforeParentheses_alpha = '';
                }else{
                  beforeParentheses = combinedText.match(regexParentheses_beforeParentheses)[1]
                  beforeParentheses_alpha = beforeParentheses.slice(0, -insideParentheses.length);
                }
                const regexParentheses_afterParentheses = /\([^()]+\)([^()]+)/;
                let afterParentheses;     
                if(!pushText.match(regexParentheses_afterParentheses)){
                  afterParentheses = '';
                }else{
                  afterParentheses = combinedText.match(regexParentheses_afterParentheses)[1]
                }
                
                for (let i = 0; i < 2; i++) {
                  data.push({
                    id: `${++counter_id}`,
                    case_or_voice: `${case_pattern}`,
                    number: `${number}`,
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
  //'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=nt&bm=at',
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
  if (data[lastIndex].case_or_voice == '従') {
    data[lastIndex].case_or_voice = "奪";
  }
}
scrapeAndWriteCSV();
