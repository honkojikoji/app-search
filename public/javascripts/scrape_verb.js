const puppeteer = require('puppeteer');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const sleep = milliseconds =>
  new Promise(resolve =>
    setTimeout(resolve, milliseconds)
  );
let counter_id = 0; // counter_id変数を定義

async function scrapeUrl(url, replacements) {

  console.log(url)

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle0' });
  await sleep(3000);
  const h2Text = await page.$eval('h2', node => node.textContent.trim());
  let Mood;
  const moods=['現在','命令','願望','アオリスト','未来']
  for(let mood of moods){
    if(h2Text.includes(mood)){
      Mood = mood;
    }
  }

  let wordClass = '動詞'


  const flgText = await page.$eval('tr:nth-child(2) > td:nth-child(1)', node => node.textContent.trim());
  let flg = false;
  let childElementCount;
  if (flgText) {
    flg = true;
    childElementCount = await page.$eval('tr:nth-child(2)', node => node.childElementCount);
  }

  const data = [];
  const tableCount = await page.$$eval('table', tables => tables.length);
  for (let tableIndex = 0; tableIndex < tableCount; tableIndex++) {
    let columns;
    const selector_checker = `table:nth-child(${tableIndex + 2}) > tbody > tr:last-child > td`;
    let tdCount = await page.$$eval(selector_checker , tds => tds.length);
    if(Mood == 'アオリスト'){
      tdCount = 6;
    }
    if(tdCount == 6){
      columns = [2, 3, 5, 6];
    }else if(tdCount == 3){
      columns = [2, 3];
    }


    console.log(tdCount)
    let startRow = 3;
    let endRow = 3 + startRow;
    if(Mood == 'アオリスト'){
      endRow = 13 + startRow;
    }
    for (let row = startRow; row < endRow; row++) {
      for (let column of columns) {
        const selector = `table:nth-child(${tableIndex + 2}) > tbody > tr:nth-child(${row}) > td:nth-child(${column})`;
        const textInFirstColumn = await page.$eval(`table:nth-child(${tableIndex + 2}) > tbody > tr:nth-child(${row}) > td:nth-child(1)`, node => node.textContent.trim());
        const textInFirstRow = await page.$eval(`table:nth-child(${tableIndex + 2}) > tbody > tr:nth-child(${startRow -1}) > td:nth-child(${column})`, node => node.textContent.trim());
        const voice =  (await page.$eval(`table:nth-child(${tableIndex + 2}) > tbody > tr:nth-child(${startRow -1}) > td:nth-child(${column - Math.floor(((column-1) % 3)) })`, node => node.textContent.trim())).slice(1);
        console.log(selector)
        const htmlContent = await page.evaluate((selector) => {
          const element = document.querySelector(selector);
          let html = element.innerHTML;
          if (html.includes('pm.gif')){
            // 'pm.gif' を基準に文字列を分割する
            let parts =html.split(/pm\.gif/);

            // 分割された文字列の前半部分と後半部分を取得する
            let firstPart = parts[0];
            let secondPart = 'pm.gif' + parts.slice(1).join('pm.gif');
            // '../f/' を '../r/' に置換する
            secondPart = secondPart.replace(/\.\.\/f\//g, '../r/');
            html = firstPart + secondPart;
          }
          const htmlArray = html.split('<br>').join('pm.gif').split('pm.gif');
          return htmlArray;
        }, selector);
        for (let index = 0; index < htmlContent.length; index++) {
          let matches;
          let flg_parentheses=false;
          if(htmlContent[index].includes('(')){
            flg_parentheses=true;
          }
          if(tdCount == 3){
            matches = htmlContent[index].match(/(?:\.\.\/f\/)([a-z0-9]+(?:-[a-z0-9]+)*)(?:\.gif)/g);
          }else{
            matches = htmlContent[index].match(/(?:\.\.\/r\/)([a-z0-9]+(?:-[a-z0-9]+)*)(?:\.gif)/g);
          }
          
          console.log(matches)
          if (matches) {
            const combinedMatches = matches.map(match => {
              let replacedMatch;
              if(tdCount == 3){
                replacedMatch = match.replace('../f/', '').replace('.gif', '');
              }else{
                replacedMatch = match.replace('../r/', '').replace('.gif', '');
              }
              return replacements[replacedMatch] || replacedMatch;
            });
            const combinedText = combinedMatches.join('');            
            if (combinedText.includes('(')) {
              //countOccurrences(X, '(')
              const regexParentheses_insideParentheses = /\(([^()]+)\)/;
              const insideParentheses = combinedText.match(regexParentheses_insideParentheses)[1];

              const regexParentheses_beforeParentheses = /^([^()]+)\([^()]+\)/;
              let beforeParentheses;
              let beforeParentheses_alpha;
              if(!combinedText.match(regexParentheses_beforeParentheses)){
                beforeParentheses = '';
                beforeParentheses_alpha = '';
              }else{
                beforeParentheses = combinedText.match(regexParentheses_beforeParentheses)[1]
                beforeParentheses_alpha = beforeParentheses.slice(0, -insideParentheses.length);
              }
              const regexParentheses_afterParentheses = /\([^()]+\)([^()]+)/;
              let afterParentheses;     
              if(!combinedText.match(regexParentheses_afterParentheses)){
                afterParentheses = '';
              }else{
                afterParentheses = combinedText.match(regexParentheses_afterParentheses)[1]
              }
              
              //console.log(beforeParentheses + afterParentheses,beforeParentheses_alpha + insideParentheses + afterParentheses)
              for (let i = 0; i < 2; i++) {
                data.push({
                  id: `${++counter_id}`,
                  word_class: `${wordClass}`,
                  voice: `${voice}`,
                  mood: `${Mood}`,
                  case_pattern: `${textInFirstColumn}`,
                  number: `${textInFirstRow}`,
                  ending_pattern: `${i === 0 ? beforeParentheses + afterParentheses : beforeParentheses_alpha + insideParentheses + afterParentheses}`,
                  url: `${url}`
                });
                modifyData(data);
              }
            } else {
              data.push({
                id: `${++counter_id}`,
                word_class: `${wordClass}`,
                voice: `${voice}`,
                mood: `${Mood}`,
                case_pattern: `${textInFirstColumn}`,
                number: `${textInFirstRow}`,
                ending_pattern: `${combinedText}`,
                url: `${url}`
              });
              modifyData(data);
            }
          }
        }
      }      
      if(Mood == 'アオリスト' && (row % 5) == 0){
        if(row == 10){
          console.log(123456)
          columns = [2, 3];
        }
        row = row + 2;
      }
    }
  }

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
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=vb&bm=pres',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=vb&bm=atthi',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=vb&bm=bhavati',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=vb&bm=impv',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=vb&bm=opt',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=vb&bm=atthiopt',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=vb&bm=aor',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=vb&bm=fut'
  ];

  
  let allData = [];
  for (let url of urls) {
    const data = await scrapeUrl(url, replacements);
    allData = [...allData, ...data];
  }

  // CSVファイルにデータを書き込む
  const csvData = allData.map(row => `${row.id},${row.word_class},${row.voice},${row.mood},${row.case_pattern},${row.number},${row.ending_pattern},${row.url}`).join('\n');
  fs.writeFileSync('../../pali_verb.csv', csvData);
  console.log('CSV data creation completed.');

  // SQLite3データベースにデータを書き込む
  const dbPath = '../../pali_verb.db';
  if (fs.existsSync(dbPath)) {
    // ファイルが既に存在する場合は削除する
    fs.unlinkSync(dbPath);
    console.log('Existing database file deleted.');
  }
  const db = new sqlite3.Database(dbPath);
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS pali_verb (
      id INTEGER PRIMARY KEY,
      word_class TEXT,
      voice TEXT,
      mood TEXT,
      case_pattern TEXT,
      number TEXT,
      ending_pattern TEXT,
      url TEXT
    )`);

    const insertStmt = db.prepare(`INSERT INTO pali_verb (word_class, voice, mood, case_pattern, number, ending_pattern, url)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);

    allData.forEach(row => {
      insertStmt.run(row.word_class, row.voice, row.mood, row.case_pattern, row.number, row.ending_pattern, row.url);
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

  console.log('Scraping and data creation completed.');
}
function modifyData(data) {
  const lastIndex = data.length - 1;
  if (data[lastIndex].mood == '未来') {
    data[lastIndex].ending_pattern = 'issa' + data[lastIndex].ending_pattern;
  }
}

const countOccurrences = (str, target) => {
  // 文字列を正規表現でマッチさせ、マッチした部分の配列を取得します
  const mchs = str.match(new RegExp(target, 'g'));
  // マッチした部分の配列が存在する場合、その長さ（マッチ回数）を返します。存在しない場合は 0 を返します
  return mchs ? mchs.length : 0;
};

scrapeAndWriteCSV();
