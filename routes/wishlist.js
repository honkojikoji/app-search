var express = require('express');
var router = express.Router();
var sqlite3 = require('sqlite3');
const db = new sqlite3.Database('wishlist.db');


/* GET 全データ出力 */
router.get('/',(req, res, next)=> {
  db.serialize(()=>{
    db.all("select * from wishlist",(err,rows)=>{
      if(!err){
        var data={
          title: "Wish List",
          content: rows
        };
        res.render('wishlist', data);
      }
    })
  })
  
});

/*search検索用*/
router.get('/search',(req, res, next)=> {
  const keyword = req.query.wish
  const array = [];

  for (let i = 0; i < keyword.length; i++) {
    const extractedChar = keyword.slice(-1 * (i + 1));
    array.unshift(extractedChar);
  }
/*   const array = ['a', 'i', 'u', 'e', 'o']; */
  const placeholders = array.map(() => '?').join(', ');
  const query = `SELECT * FROM wishlist WHERE wish IN (${placeholders})`;
  db.serialize(()=>{
    db.all(query,array,(err,rows)=>{
      if(!err){
        var data={
          title: "Wish List",
          content: rows
        };
        res.render('wishlist', data);
      }
    })
  })
});
/* GET add page.　追加用のページの出力処理 */
router.get('/add',(req, res, next)=> {
  
        var data={
          title: "Add Wish List"
        };
        res.render('add', data); 
});
/*post　Wishの追加*/
router.post('/',(req, res, next)=> {
 
  let wish = req.body.wish
  let memo = req.body.memo
  let finished = req.body.finished
  db.serialize(()=>{
    db.exec(`insert into wishlist (wish, memo, finished) values("${wish}","${memo}","${finished}")`,(stat,error)=>{
      res.redirect('/wishlist');
    });

  });
});

module.exports = router;