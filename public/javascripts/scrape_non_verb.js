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
  await sleep(3000);
  const h2Text = await page.$eval('h2', node => node.textContent.trim());
  let wordClass = h2Text.includes('形容詞') ? '形容詞' : '名詞';
  if (url.includes("tb=pr")){
    if(url.includes("bm=pr")){
      wordClass = "代名詞型形容詞"
    }else{
      wordClass = "代名詞"
    }
  }else if(url.includes("num&bm=c0")){
    wordClass = "数詞"
  }


  let h2ScrText = '';
  const h2Content = await page.$eval('h2', node => node.innerHTML);
  const matches = h2Content.match(/(?:\.\.\/f\/)([a-z0-9]+(?:-[a-z0-9]+)*)(?:\.gif)/g);
  if (matches) {
    const combinedMatches = matches.map(match => {
      const replacedMatch = match.replace('../f/', '').replace('.gif', '').replace('pm', '');
      return replacements[replacedMatch] || replacedMatch;
    });
    h2ScrText = combinedMatches.join('');
  }


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
    
    const tdCount = await page.$$eval(selector_checker , tds => tds.length);
    if (tdCount == 2) {
      columns = [2];
    } else if(tdCount == 3) {
      columns = [2, 3]; 
    } else if(tdCount == 4){
      columns = [2, 3, 4];
    } else if(tdCount == 6){
      columns = [2, 3, 5, 6];
    } else{
      columns = [2, 3, 5, 6, 8, 9];
    }
    let startRow = (tableCount > 1 && tableIndex === 0) ? 4 : 3;
    if(((wordClass.includes("代名詞") || wordClass == "数詞") && tdCount > 6) || wordClass == '形容詞' ){
      startRow++;
    }
    let endRow;
    if(url.includes("tb=pr") || url.includes("num&bm=c0")){
      endRow = 7 + startRow;
    }else{
      endRow = 8 + startRow;
    }

    for (let row = startRow; row < endRow; row++) {
      for (let column of columns) {
        const selector = `table:nth-child(${tableIndex + 2}) > tbody > tr:nth-child(${row}) > td:nth-child(${column})`;
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
          if(url.includes("tb=pr") && !url.includes("bm=pr")){
            matches = htmlContent[index].match(/(?:\.\.\/f\/)([a-z0-9]+(?:-[a-z0-9]+)*)(?:\.gif)/g);
          }else if(wordClass == "数詞"){
            matches = htmlContent[index].match(/(?:\.\.\/[fr]\/)([a-z0-9]+(?:-[a-z0-9]+)*)(?:\.gif)/g);
          }else{
            matches = htmlContent[index].match(/(?:\.\.\/r\/)([a-z0-9]+(?:-[a-z0-9]+)*)(?:\.gif)/g);
          }
          if (matches) {
            const combinedMatches = matches.map(match => {
              let replacedMatch;
              if (url.includes("tb=pr") && !url.includes("bm=pr")){
                replacedMatch = match.replace('../f/', '').replace('.gif', '');
              }else if(wordClass == "数詞"){
                replacedMatch = match.replace('../f/', '').replace('../r/', '').replace('.gif', '');
              }else{
                replacedMatch = match.replace('../r/', '').replace('.gif', '');
              }
              return replacements[replacedMatch] || replacedMatch;
            });
            const combinedText = combinedMatches.join('');
            if (combinedText.includes('(')) {

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
              
              for (let i = 0; i < 2; i++) {
                data.push({
                  id: `${++counter_id}`,
                  case_pattern: `${textInFirstColumn}`,
                  number: `${textInFirstRow}`,
                  word_class: `${wordClass}`,
                  root: `${h2ScrText}`,
                  ending_pattern: `${i === 0 ? beforeParentheses + afterParentheses : beforeParentheses_alpha + insideParentheses + afterParentheses}`,
                  sex: tableIndex === 1 ? '女性' : (flg ? (column < 4 ? '男性' : (column < 7 ? '中性' : '女性')) : h2Text),
                  url: `${url}`
                });
                modifyData(data, tdCount, h2Text, url, column, wordClass ,index, tableIndex);
              }
            } else {
              data.push({
                id: `${++counter_id}`,
                case_pattern: `${textInFirstColumn}`,
                number: `${textInFirstRow}`,
                word_class: `${wordClass}`,
                root: `${h2ScrText}`,
                ending_pattern: `${combinedText}`,
                sex: tableIndex === 1 ? '女性' : (flg ? (column < 4 ? '男性' : (column < 7 ? '中性' : '女性')) : h2Text),
                url: `${url}`
              });
              modifyData(data, tdCount, h2Text, url, column, wordClass ,index, tableIndex);
            }
          }
        }
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
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=na&bm=am',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=na&bm=an',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=na&bm=aaf',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=na&bm=aa',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=na&bm=aia',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=ni&bm=im',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=ni&bm=in',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=ni&bm=if',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=ni&bm=iif',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=ni&bm=ia',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=nu&bm=um',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=nu&bm=un',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=nu&bm=uf',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=nu&bm=uum',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=nu&bm=uuf',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=nu&bm=ua',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=nu&bm=o',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=nn&bm=anm',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=nn&bm=ann',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=nn&bm=inm',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=nn&bm=inn',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=nt&bm=vat',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=nt&bm=at',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=ns&bm=as',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=ns&bm=manas',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=ns&bm=us',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=ns&bm=arm',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=ns&bm=arf',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=pr&bm=aham3',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=pr&bm=tvam3',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=pr&bm=so',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=pr&bm=imam3',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=pr&bm=asu',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=pr&bm=etad',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=pr&bm=ka',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=pr&bm=kaci',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=pr&bm=ya',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=pr&bm=pr',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=num&bm=c01',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=num&bm=c02',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=num&bm=c03',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=num&bm=c04',
    'https://www.manduuka.net/pali/p/pdisp.cgi?tb=num&bm=c05'
  ];


  let allData = [];
  for (let url of urls) {
    const data = await scrapeUrl(url, replacements);
    allData = [...allData, ...data];
  }

  // CSVファイルにデータを書き込む
  const csvData = allData.map(row => `${row.id},${row.word_class},${row.root},${row.sex},${row.case_pattern},${row.number},${row.ending_pattern},${row.url}`).join('\n');
  fs.writeFileSync('../../pali_non_verb.csv', csvData);
  console.log('CSV data creation completed.');

  // SQLite3データベースにデータを書き込む
  const dbPath = '../../pali_non_verb.db';
  if (fs.existsSync(dbPath)) {
    // ファイルが既に存在する場合は削除する
    fs.unlinkSync(dbPath);
    console.log('Existing database file deleted.');
  }
  const db = new sqlite3.Database(dbPath);
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS pali_non_verb (
      id INTEGER PRIMARY KEY,
      word_class TEXT,
      root TEXT,
      sex TEXT,
      case_pattern TEXT,
      number TEXT,
      ending_pattern TEXT,
      url TEXT
    )`);

    const insertStmt = db.prepare(`INSERT INTO pali_non_verb (word_class, root, sex, case_pattern, number, ending_pattern, url)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);

    allData.forEach(row => {
      insertStmt.run(row.word_class, row.root, row.sex, row.case_pattern, row.number, row.ending_pattern, row.url);
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
function modifyData(data, tdCount, h2Text, url, column, wordClass ,index, tableIndex) {
  const lastIndex = data.length - 1;
  if (tdCount < 3 && lastIndex >= 0) {
    data[lastIndex].sex = "中性";
  }
  if (!h2Text.includes('性') && tdCount < 9) {
    if(data[lastIndex].root == 'manas'){
      data[lastIndex].sex = "中性";
    }else if(data[lastIndex].root.includes('at')){
      if(tableIndex == 1){
        data[lastIndex].sex = "女性";
      }else{
        if(column < 4){
          data[lastIndex].sex = "男性";
        }else{
          data[lastIndex].sex = "中性";
        }
      }
    }else{
      data[lastIndex].sex = "性なし";
    }
  }
  if (url.includes('tb=na&bm=aia')) {
    if (column > 7) {
      data[lastIndex].root = 'ī'
    } else {
      data[lastIndex].root = 'a'
    }
  }
  if (url.includes('tb=pr&bm=so')) {
    if (column < 4) {
      data[lastIndex].root = 'so'
    } else if (column < 7) {
      data[lastIndex].root = 'taṃ'
    } else {
      data[lastIndex].root = 'sā'
    }
  }
  if (data[lastIndex].root == 'atvatmat') {
    data[lastIndex].root = '(vm)at'
  }
  if (url.includes('tb=num') && url.includes('bm=c05')) {
    data[lastIndex].number = 'なし';
  }
  if (wordClass == "代名詞型形容詞") {
    data[lastIndex].root = 'a'
  }
  if (wordClass == "数詞") {
    if (!url.includes('bm=c01')) {
      data[lastIndex].number = 'なし';
    }
    if (tdCount == 2) {
      data[lastIndex].sex = '男中女性';
    } else if (tdCount == 4) {
      if (column == 2) {
        data[lastIndex].sex = '男性';
      } else if (column == 3) {
        data[lastIndex].sex = '中性';
      } else {
        data[lastIndex].sex = '女性';
      }
    }
    if(url.includes('bm=c05')){
      if(index==0){
        data[lastIndex].root = 'a';
        data[lastIndex].ending_pattern = data[lastIndex].ending_pattern.slice(4);
      }else{
        data[lastIndex].root = 'dasa';
      }
    }
  }
}


scrapeAndWriteCSV();
