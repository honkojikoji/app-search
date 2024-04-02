const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('skt.db');
const tableName = "skt";
const replacements = {
  'A': 'ā',
  'I': 'ī',
  'U': 'ū',
  'R': 'ṛ',
  'q': 'ṝ', 
  'L': 'ḷ',
  'G': 'ṅ',
  'J': 'ñ',
  'N': 'ṇ',
  'T': 'ṭ',
  'D': 'ḍ',
  'z': 'ś',
  'S': 'ṣ',
  'M': 'ṃ',
  'H': 'ḥ'
  // Add other replacements here if needed
};

function replaceTextWithMap(text, map) {
  // 正規表現パターンを作成し、置換を行う（大文字小文字を区別）
  const pattern = new RegExp(Object.keys(map).map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
  return text.replace(pattern, match => map[match] || match);
}

/* GET 全データ出力 */
router.get('/', (req, res, next) => {
  var data = {
    title: "Sanskrit 検索",
    flg: false,
  };
  res.render('skt', data);
});

/* search検索用 */
router.get('/search', (req, res) => {
  let keyword = replaceTextWithMap(req.query.skt_search, replacements);
  let flg_space;
  if (keyword == "") {
    var data = {
      title: "Sanskrit 検索",
      flg: false,
    };
    res.render('skt', data);
  } else {
    const array = [];
    for (let i = 0; i < keyword.length; i++) {
      const extractedChar = keyword.slice(-1 * (i + 1));
      array.unshift(extractedChar);
    }
    const placeholders = array.map(() => '?').join(', ');
    
    const query = `SELECT * FROM ${tableName} WHERE ending_pattern IN (${placeholders})`;
    db.serialize(() => {
      db.all(query, array, (err, rows) => {
        if (!err) {
          var data = {
            title: keyword,
            content: rows,
            flg: flg_space,
          };
          res.render('skt', data); // EJSテンプレートをレンダリング
        }
      });
    });
  }
});

module.exports = router;
