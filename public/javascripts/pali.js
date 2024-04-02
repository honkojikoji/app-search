const puppeteer = require('puppeteer');
const fs = require('fs');
const setTimeout = require("node:timers/promises").setTimeout;

// 数字を除去する関数
function removeNumbersFromString(string) {
  return string.replace(/\d+/g, '');
}

async function clickTenthLi() {
  // ブラウザと新しいページを開く（ヘッドレスモードを無効にする）
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  console.log(1)

  // 指定したURLに移動し、ページのロードが完了するのを待つ
  await page.goto('https://www.manduuka.net/pali/p/pndx.htm', { waitUntil: 'networkidle0' });
  console.log(2)

  // .d3要素の子要素である全てのaタグ要素のhref属性を取得してコンソールに出力
  const d3Elements = await page.$$('.d3');
  const allHrefs = [];

  for (let i = 0; i < d3Elements.length; i++) {
    const d3Element = d3Elements[i];
    const anchors = await d3Element.$$('a');

    for (let j = 0; j < anchors.length; j++) {
      const anchor = anchors[j];
      const href = await anchor.evaluate(node => node.getAttribute('href'));
      allHrefs.push(href);
    }
  }

  console.log(allHrefs);
  
  // ブラウザを閉じる
  await browser.close();
}

clickTenthLi();



