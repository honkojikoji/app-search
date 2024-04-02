const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const router = express.Router();

const urlArray = [
  'https://pente.koro-pokemon.com/zukan/001.shtml',
  'https://pente.koro-pokemon.com/zukan/002.shtml',
  'https://pente.koro-pokemon.com/zukan/003.shtml',
  'https://pente.koro-pokemon.com/zukan/004.shtml',
  'https://pente.koro-pokemon.com/zukan/005.shtml',
];

// 非同期で待機する関数
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

router.get('/', async (req, res) => {
  res.render('test01');
});

router.post('/scrape', async (req, res) => {
  const scrapedData = [];
  const coolTime = 1000; // ミリ秒単位でクールタイムを指定

  for (const url of urlArray) {
    try {
      console.log(`Scraping data from ${url}...`);

      // クールタイムを挿入
      await delay(coolTime);

      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      const nameText = $('h1').text(); // ここを修正
      console.log(`Scraped name from ${url}: ${nameText}`);
      scrapedData.push(nameText);
    } catch (error) {
      console.error(`Error scraping ${url}:`, error.message);
      scrapedData.push('Error');
    }
  }

  console.log('Scraping complete.');
  console.log('Scraped Data:', scrapedData);
  res.json({ data: scrapedData });
});

module.exports = router;
