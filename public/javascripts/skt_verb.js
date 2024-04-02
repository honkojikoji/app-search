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
  console.log(url,counter_id)
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle0' });
  const h2Text = await page.$eval('h2', node => node.textContent.trim());
  let remark = "";
  let mood;
  let targetChar = " ";
  let index = h2Text.indexOf(targetChar);
  if (index !== -1) {
    mood = h2Text.substring(0, index);
    if(h2Text.substring(index + 1)){
      remark = h2Text.substring(index + 1);
    }
  }else{
    mood = h2Text;
  }
  let voice;
  let wordClass = '動詞'

  const tableCount = await page.$$eval('table', tables => tables.length);
  for (let tableIndex = 0; tableIndex < tableCount; tableIndex++) {
    let columns = [2, 3, 4, 6, 7, 8];
    let startRow = 3;
    let endRow = 3 + startRow;
    for (let row = startRow; row < endRow; row++) {
      for (let column of columns) {
        const selector = `table > tbody > tr:nth-child(${row}) > td:nth-child(${column})`;
        const number = await page.$eval(`table > tbody > tr:nth-child(${startRow - 1}) > td:nth-child(${column})`, node => node.textContent.trim()); 
        const person = await page.$eval(`table > tbody > tr:nth-child(${row}) > td:nth-child(1)`, node => node.textContent.trim());

        if(column < 5){
          voice = '能動態';
        }else{
          voice = '反射態';
        }
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
            let secondChar = modifiedText.slice(1, 2); // 1番目のインデックスから2番目のインデックスの直前までを取得
            console.log(secondChar)
            if(url.includes('n1') && secondChar != 'a' && secondChar != 'ā' && secondChar != 'e'){
              if(secondChar == 'v' || secondChar == 'm'){
                pushTexts.push('ā' + modifiedText.replace('-',''));
              }else{
                pushTexts.push('a' + modifiedText.replace('-',''));
              }
            }else{
              pushTexts.push(modifiedText.replace('-',''));
            }
          }
          for (let pushText of pushTexts){
            data.push({
              id: `${++counter_id}`,
              case_or_voice: `${voice}`,
              number: `${number}`,
              word_class: `${wordClass}`,
              root_or_mood: `${mood}`,
              ending_pattern: `${pushText}`,
              gender_or_person: `${person}`,
              remark: `${remark}`,
              url: `${url}`
            });
            modifyData(data);
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
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=vend&bm=e1n1',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=vend&bm=e1n2',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=vend&bm=e2n1',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=vend&bm=e2n2',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=vend&bm=opn1',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=vend&bm=opn2',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=vend&bm=imn1',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=vend&bm=imn2',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=vend&bm=pf'
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
}
