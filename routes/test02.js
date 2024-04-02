var express = require('express');
var router = express.Router();
const puppeteer = require('puppeteer');

router.get('/', async (req, res) => {
    res.render('test02');
});

/* POST test page with scraped data. */
router.post('/scrape', async function(req, res, next) {
    try {
        const keyword = req.body.keyword;
        console.log('Received keyword:', keyword);

        // Puppeteerを使用してページを開く
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto('https://www.manduuka.net/sanskrit/dic/ogdic.htm?kw=' + keyword);

        // id="inputp"の値を取得
        const inputValue = await page.$eval('#inputp', input => input.value);
        console.log("Scraped Input Value:", inputValue);

        // ブラウザを閉じる
        await browser.close();

        // 取得した値をレスポンスとして送信
        res.json({ inputValue: inputValue });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
