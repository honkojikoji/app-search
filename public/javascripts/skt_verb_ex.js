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
  let remark = "";
  let mood;
  let voice;
  let wordClass = '動詞'

  const tableCount = await page.$$eval('table', tables => tables.length);
  for (let tableIndex = 0; tableIndex < tableCount; tableIndex++) {
    const selector_checker = `table > tbody > tr:nth-child(4) > td`;
    const tdCount = await page.$$eval(selector_checker , tds => tds.length);
    let columns;
    if(tdCount==4){
      columns = [2, 3, 4];
    }else if(tdCount==8){
      columns = [2, 3, 4, 6, 7, 8];
    }
    let rows = [4, 5, 6, 9, 10, 11, 14, 15, 16, 19, 20, 21];
    if(url == 'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v3&bm=haa'){
      rows = rows.map(num => num + 1);
    }
    let row_counter = 0;
    for (let row of rows) {
      row_counter++;
      let column_counter = 0;
      for (let column of columns) {
        column_counter++;
        if(row < 7){
          mood = '現在';
        }else  if(row < 12){
          mood = '過去';
        }else  if(row < 17){
          mood = '願望法';
        }else  {
          mood = '命令法';
        }
        console.log(mood)
        const firstselector = `table > tbody > tr:first-child > td:first-child`;
        let firsttext = await page.$eval(firstselector, node => node.textContent.trim());
        if (firsttext.indexOf(' ') !== -1) { // 空白が見つかった場合
          remark = firsttext.slice(0, firsttext.indexOf(' ')); // 空白よりも前の部分を切り取る
        }else if(firsttext.indexOf('(') !== -1) { // 空白が見つかった場合
          remark = firsttext.slice(0, firsttext.indexOf('(')); // (よりも前の部分を切り取る
        }else{
          console.log("Space not found in the string.");
        }
        if(url.charAt(50) == '0'){
          remark = remark + '(第10類)';
        }else{
          remark = remark + '(第' + url.charAt(50) + '類)';
        }
        console.log(remark)
        const selector = `table > tbody > tr:nth-child(${row}) > td:nth-child(${column})`;
        let number;
        if(column_counter % 3 == 1){
          number = '単';
        }else if(column_counter % 3 == 2){
          number = '両';
        }else{
          number = '複';
        }
        let person;
        if(row_counter % 3 == 1){
          person = '1人称';
        }else if(row_counter % 3 == 2){
          person = '2人称';
        }else{
          person = '3人称';
        }

        let row_check = row_counter % 3;
        if(row_check == 0){
          row_check = 3;
        }
        let column_check = column_counter % 3;
        if(column_check == 0){
          column_check = 3;
        }
        const target_selector = `table > tbody > tr:nth-child(${row - row_check}) > td:nth-child(${column - column_check})`;
        let target_text = await page.$eval(target_selector, node => node.textContent.trim());
        voice = target_text.replace('◎','');
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
            pushTexts.push(modifiedText.replace('-',''));
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
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v1&bm=std',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v1&bm=stdn',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v1&bm=aa',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v1&bm=aan',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v1&bm=ai',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v1&bm=ain',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v1&bm=au',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v1&bm=aun',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v1&bm=aar',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v2n&bm=stds3',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v2n&bm=yaa',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v2n&bm=i',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v2n&bm=duh',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v2n&bm=lih',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v2n&bm=aas',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v2n&bm=yu',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v2n&bm=rud',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v2n&bm=suu',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v2s&bm=ad',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v2s&bm=as',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v2s&bm=cakaas',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v2s&bm=jaks3',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v2s&bm=mr3j',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v2s&bm=bruu',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v2s&bm=vac',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v2s&bm=vas2',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v2s&bm=vid',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v2s&bm=s2aas',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v2s&bm=s2ii',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v2s&bm=stu',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v2s&bm=han',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v3&bm=std',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v3&bm=daa',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v3&bm=dhaa',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v3&bm=maa',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v3&bm=haa',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v4&bm=std',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v4&bm=stdn',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v4&bm=aa',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v4&bm=ain',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v4&bm=aar',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v5&bm=std',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v5&bm=aap',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v5&bm=s2ru',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v5&bm=taks3',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v6&bm=std',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v6&bm=stdn',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v6&bm=ai',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v6&bm=au',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v6&bm=aar',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v6&bm=aarn',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v7&bm=std',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v7&bm=rudh',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v7&bm=yuj',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v7&bm=pis3',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v7&bm=him3s',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v8&bm=std',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v8&bm=kr3',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v9&bm=std',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v9&bm=stdn',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v9&bm=krii',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v9&bm=bandh',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v9&bm=jn2aa',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v9&bm=puu',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v9&bm=grah',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v9&bm=str4',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v9&bm=jyaa',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v0&bm=std',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v0&bm=stdn',
    'https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=v0&bm=aa'
  ];
  data.push({
    id: `${++counter_id}`,
    case_or_voice: `能動態`,
    number: `複`,
    word_class: `動詞`,
    root_or_mood: `アオリスト`,
    ending_pattern: `us`,
    gender_or_person: `3人称`,    
    remark: ``,
    url: `https://www.manduuka.net/sanskrit/p/pdisp.cgi?tb=va&bm=rt`
  });
  modifyData(data);
  
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
