

//===============================================================
//  フィルタテーブルの共通変数　設定要！
//===============================================================
var gTabldID = 'data-table';  // テーブルのエリアのIDを設定
var gTfStartRow = 0;
var gTfColList  = [];             // ボタンが配置されている列番号
var gTfListSave = {};             // フィルタリストの保存状態
var currentArg = 0;
//===============================================================
//  オンロードでテーブル初期設定関数をCALL
//===============================================================
window.onload = function() {
 tFilterInit();
 
}

function tFilterInit(){
//==============================================================
//  テーブルの初期設定
//==============================================================
 var wTABLE  = document.getElementById(gTabldID);
 var wTR     = wTABLE.rows;
 var wAddBtn = '';

 // ------------------------------------------------------------
 //   テーブル内をフィルタボタンを付ける
 // ------------------------------------------------------------
 for(var i=0; i < wTR.length; i++){

   var wTD     = wTABLE.rows[i].cells;

   for(var j=0; j < wTD.length; j++){

     // --- 「cmanFilterBtn」の定義があるセルを対象とする ------
     if(wTD[j].getAttribute('cmanFilterBtn') !== null){

       // --- フィルタ対象はボタンの次の行から -----------------
       gTfStartRow = i + 1;

       // --- ボタンを追加（画像はsvgを使用） ------------------
       wAddBtn  = '<div class="tfArea">';
       wAddBtn += '<svg class="tfImg" id="tsBtn_'+j+'" onclick="tFilterCloseOpen('+j+')"><path d="M0 0 L9 0 L6 4 L6 8 L3 8 L3 4Z"></path></svg>';
       wAddBtn += '<div class="tfList" id="tfList_'+j+'" style="display:none; position: absolute; z-index: 9999;">';
       wAddBtn += tFilterCreate(j);
       wAddBtn += '</div>';
       wAddBtn += '</div>';
       wTD[j].innerHTML = wTD[j].innerHTML+wAddBtn;

       // --- フィルタボタンなる列を保存 -----------------------
       gTfColList.push(j);
     }
   }

   // --- ボタンを付けたら以降の行は無視する -------------------
   if(wAddBtn != ''){
     gSortBtnRow = i;
     break;
   }

 }
}

function tFilterCreate(argCol){
  
//==============================================================
//  指定列のフィルタリスト作成
//==============================================================

 var wTABLE    = document.getElementById(gTabldID);
 var wTR       = wTABLE.rows;
 var wItem     = [];              // クリックされた列の値
 var wNotNum   = 0;               // 1 : 数字でない
 var wItemSave = {};              // フィルタに設定した値がキー
 var rcList    = '';              // 返すフィルタリスト

 // ------------------------------------------------------------
 //  クリックされた列の値を取得する
 // ------------------------------------------------------------
 for(var i=gTfStartRow; i < wTR.length; i++){
   var j = i - gTfStartRow;

   wItem[j] = wTR[i].cells[argCol].innerText.toString();

   if(wItem[j].match(/^[-]?[0-9,\.]+$/)){
   }else{
       wNotNum = 1;
   }

 }

 // ------------------------------------------------------------
 //  列の値でソートを実行
 // ------------------------------------------------------------
   if(wNotNum == 0){
     wItem.sort(sortNumA);           // 数値で昇順
   }else{
     wItem.sort(sortStrA);           // 文字で昇順
   }

 // ------------------------------------------------------------
 //  「すべて」のチェックボックス作成
 // ------------------------------------------------------------
 var wItemId =  id='tfData_ALL_'+argCol;

 rcList += '<div class="tfMeisai">';
 rcList += '<input type="checkbox" id="'+wItemId+'" checked onclick="tFilterAllSet('+argCol+')">';
 rcList += '<label for="'+wItemId+'">(すべて)</label>';
 rcList += '</div>';

 // ------------------------------------------------------------
 //  列の値でフィルタのチェックボックスを作成する
 //    チェックボックスはformで囲む
 // ------------------------------------------------------------
 rcList += '<form name="tfForm_'+argCol+'">';

 for(var i=0; i < wItem.length; i++){

   wVal = trim(wItem[i]);

   if(wVal in wItemSave){
     // ---値でチェックボックスが作成されている(重複) ----------
   }else{

     // ---チェックボックスの作成 ------------------------------
     wItemId =  id='tfData_'+argCol+'_r'+i;
     rcList += '<div class="tfMeisai">';
     rcList += '<input type="checkbox" id="'+wItemId+'" value="'+wVal+'" checked onclick="tFilterClick('+argCol+')">';
     rcList += '<label for="'+wItemId+'">'+( wVal=='' ? '(空白)' : wVal )+'</label>';
     rcList += '</div>';

     // ---重複判定用にチェックボックスの値を保存 --------------
     wItemSave[wVal]='1';
   }
 }
 rcList += '</form>';

 // ------------------------------------------------------------
 //  文字抽出のinputを作成
 // ------------------------------------------------------------
 rcList += '<div class="tfInStr">';
 rcList += '<input type="text" placeholder="含む文字抽出" id="tfInStr_'+argCol+'">';
 rcList += '</div>';

 // ------------------------------------------------------------
 //  「OK」「Cancel」ボタンの作成
 // ------------------------------------------------------------
 rcList += '<div class="tfBtnArea">';
 rcList += '<input type="button" value="OK" onclick="tFilterGo()">';
 rcList += '<input type="button" value="Cancel" onclick="tFilterCancel('+argCol+')">';
 rcList += '</div>';

 // ------------------------------------------------------------
 //  作成したhtmlを返す
 // ------------------------------------------------------------
 return rcList;

}

function tFilterClick(argCol){
  
//==============================================================
//  フィルタリストのチェックボックスクリック
//    「すべて」のチェックボックスと整合性を合わせる
//==============================================================
 var wForm   = document.forms['tfForm_'+argCol];
 var wCntOn  = 0;
 var wCntOff = 0;
 var wAll    = document.getElementById('tfData_ALL_'+argCol);   // 「すべて」のチェックボックス

 // --- 各チェックボックスの状態を集計する ---------------------
 for (var i = 0; i < wForm.elements.length; i++){
   if(wForm.elements[i].type == 'checkbox'){
     if (wForm.elements[i].checked) { wCntOn++;  }
     else                           { wCntOff++; }
   }
 }

 // --- 各チェックボックス集計で「すべて」を整備する -----------
 if((wCntOn == 0)||(wCntOff == 0)){
   wAll.checked = true;             // 「すべて」をチェックする
   tFilterAllSet(argCol);           // 各フィルタのチェックする
 }else{
    wAll.checked = false;           // 「すべて」をチェックを外す
 }
}

function tFilterCancel(argCol){
//==============================================================
//  キャンセルボタン押下
//==============================================================

 tFilterSave(argCol, 'load');    // フィルタ条件の復元
 tFilterCloseOpen('');           // フィルタリストを閉じる

}

function tFilterGo(){
//===============================================================
//  フィルタの実行
//===============================================================
 var wTABLE  = document.getElementById(gTabldID);
 var wTR     = wTABLE.rows;

 // ------------------------------------------------------------
 //  全ての非表示を一旦クリア
 // ------------------------------------------------------------
 for(var i = 0; i < wTR.length; i++){
   if(wTR[i].getAttribute('cmanFilterNone') !== null){
     wTR[i].removeAttribute('cmanFilterNone');
   }
 }

 // ------------------------------------------------------------
 //  フィルタボタンのある列を繰り返す
 // ------------------------------------------------------------
 for(var wColList = 0; wColList < gTfColList.length; wColList++){
   var wCol       = gTfColList[wColList];
   var wAll       = document.getElementById('tfData_ALL_'+wCol);     // 「すべて」のチェックボックス
   var wItemSave  = {};
   var wFilterBtn =  document.getElementById('tsBtn_'+wCol);
   var wFilterStr =  document.getElementById('tfInStr_'+wCol);

   var wForm      = document.forms['tfForm_'+wCol];
   // -----------------------------------------------------------
   //  チェックボックスの整備（「すべて」の整合性）
   // -----------------------------------------------------------
   for (var i = 0; i < wForm.elements.length; i++){
     if(wForm.elements[i].type == 'checkbox'){
       if (wForm.elements[i].checked) {
         wItemSave[wForm.elements[i].value] = 1;      // チェックされている値を保存
       }
     }
   }

   // -----------------------------------------------------------
   //  フィルタ（非表示）の設定
   // -----------------------------------------------------------
   if((wAll.checked)&&(trim(wFilterStr.value) == '')){
     wFilterBtn.style.backgroundColor = '';              // フィルタなし色
   }
   else{
     wFilterBtn.style.backgroundColor = '#ffff00';       // フィルタあり色

     for(var i=gTfStartRow; i < wTR.length; i++){

       var wVal = trim(wTR[i].cells[wCol].innerText.toString());

       // --- チェックボックス選択によるフィルタ ----------------
       if(!wAll.checked){
         if(wVal in wItemSave){
         }
         else{
           wTR[i].setAttribute('cmanFilterNone','');
         }
       }

       // --- 抽出文字によるフィルタ ----------------------------
       if(wFilterStr.value != ''){
         reg = new RegExp(wFilterStr.value);
         if(wVal.match(reg)){
         }
         else{
           wTR[i].setAttribute('cmanFilterNone','');
         }
       }
     }
   }
 }

 tFilterCloseOpen('');
 
}

function tFilterSave(argCol, argFunc){
//==============================================================
//  フィルタリストの保存または復元
//==============================================================

 // ---「すべて」のチェックボックス値を保存 ------------------
 var wAllCheck = document.getElementById('tfData_ALL_'+argCol);
 if(argFunc == 'save'){
   gTfListSave[wAllCheck.id] = wAllCheck.checked;
 }else{
   wAllCheck.checked = gTfListSave[wAllCheck.id];
 }

 // --- 各チェックボックス値を保存 ---------------------------
 var wForm    = document.forms['tfForm_'+argCol];
 for (var i = 0; i < wForm.elements.length; i++){
   if(wForm.elements[i].type == 'checkbox'){
     if(argFunc == 'save'){
       gTfListSave[wForm.elements[i].id] = wForm.elements[i].checked;
     }else{
       wForm.elements[i].checked = gTfListSave[wForm.elements[i].id];
     }
   }
 }

 // --- 含む文字の入力を保存 ---------------------------------
 var wStrInput = document.getElementById('tfInStr_'+argCol);
 if(argFunc == 'save'){
   gTfListSave[wStrInput.id] = wStrInput.value;
 }else{
   wStrInput.value = gTfListSave[wStrInput.id];
 }
}

function tFilterCloseOpen(argCol){
//==============================================================
//  フィルタを閉じて開く
//==============================================================

 // --- フィルタリストを一旦すべて閉じる -----------------------
 for(var i=0; i < gTfColList.length; i++){
   document.getElementById("tfList_"+gTfColList[i]).style.display = 'none';
 }
 // --- フィルタ条件の保存（キャンセル時に復元するため） -----
 tFilterSave(argCol, 'save');
  // --- 指定された列のフィルタリストを開く ---------------------
  if(argCol != currentArg){
    
    document.getElementById("tfList_"+argCol).style.display = '';
    currentArg = argCol;
  }else{
  }
}

function tFilterAllSet(argCol){
//==============================================================
//  「すべて」のチェック状態に合わせて、各チェックをON/OFF
//==============================================================
 var wChecked = false;
 var wForm    = document.forms['tfForm_'+argCol];

 if(document.getElementById('tfData_ALL_'+argCol).checked){
   wChecked = true;
 }

 for (var i = 0; i < wForm.elements.length; i++){
   if(wForm.elements[i].type == 'checkbox'){
     wForm.elements[i].checked = wChecked;
   }
 }
}

function sortNumA(a, b) {
//==============================================================
//  数字のソート関数（昇順）
//==============================================================
 a = parseInt(a.replace(/,/g, ''));
 b = parseInt(b.replace(/,/g, ''));

 return a - b;
}

function sortStrA(a, b){
//==============================================================
//  文字のソート関数（昇順）
//==============================================================
 a = a.toString().toLowerCase();  // 英大文字小文字を区別しない
 b = b.toString().toLowerCase();

 if     (a < b){ return -1; }
 else if(a > b){ return  1; }
 return 0;
}

function trim(argStr){
//==============================================================
//  trim
//==============================================================
 var rcStr = argStr;
 rcStr	= rcStr.replace(/^[ 　\r\n]+/g, '');
 rcStr	= rcStr.replace(/[ 　\r\n]+$/g, '');
 return rcStr;
}

//==============================================================
//  コピーボタンの設定
//==============================================================
function copyText(button) {
  // ボタンが含まれるセルの親tr要素を取得
  const tr = button.closest('tr');
  const thirdTd = tr.querySelectorAll('td')[2]; 
  // テキストを取得する
  const textContent = thirdTd.textContent;
  let tds;
  if(textContent=='動詞'){
    // "動詞"の場合、4，7，5，6番目のtd要素を取得する
    tds = [
      tr.querySelectorAll('td:nth-child(2)')[0],
      tr.querySelectorAll('td:nth-child(3)')[0],
      tr.querySelectorAll('td:nth-child(4)')[0],
      tr.querySelectorAll('td:nth-child(7)')[0],
      tr.querySelectorAll('td:nth-child(5)')[0],
      tr.querySelectorAll('td:nth-child(6)')[0]
    ];
  }else{
    // それ以外の場合、5，6，7，8番目のtd要素を取得する
    tds = [
      tr.querySelectorAll('td:nth-child(2)')[0],
      tr.querySelectorAll('td:nth-child(3)')[0],
      tr.querySelectorAll('td:nth-child(5)')[0],
      tr.querySelectorAll('td:nth-child(6)')[0],
      tr.querySelectorAll('td:nth-child(7)')[0]
    ];
  }

  // テキストをコピーするための一時的なテキストエリアを作成
  const textarea = document.createElement("textarea");
  
  // テキストをセルごとにスペースで区切って結合
  const textToCopy = tds.map(td => td.textContent.trim()).join('\t');
  
  // テキストエリアにコピーするテキストを設定
  textarea.textContent = textToCopy;
  
  // テキストエリアをbodyに追加
  document.body.appendChild(textarea);
  
  // テキストエリア内のテキストを選択してコピー
  textarea.select();
  document.execCommand("copy");
  
  // DOMからテキストエリアを削除
  document.body.removeChild(textarea);
  
  const allButtons = document.querySelectorAll('.copy_row');
  allButtons.forEach(btn => {
    if (btn !== button) {
      btn.textContent = 'copy!'; // 押されていないボタンのテキストを"copy"に変更
      btn.classList.remove('done'); // "done"クラスを削除して黒色に戻す
    } else {
      btn.textContent = 'done!'; // 押されたボタンのテキストを"done"に変更
      btn.classList.add('done'); // "done"クラスを追加して赤色にする
    }
  });
}


// ページ読み込み時にすべての.coyy_buttonボタンにイベントリスナーを追加
document.addEventListener('DOMContentLoaded', function() {
  const copyButtons = document.querySelectorAll('.coyy_button');
  copyButtons.forEach(button => {
    button.addEventListener('click', function() {
      copyText(button);
    });
  });
});

function insertText(button) {
  var inputField = document.getElementById('search'); // 入力フィールドの要素を取得
  var newText = button.textContent; // クリックされたボタンのテキストを取得
  inputField.value += newText; // 入力フィールドの値に新しいテキストを追加
}

////////////////////////////////////////////
var table_sort = {
  characters: ['a', 'ā', 'i', 'ī', 'u', 'ū', 'ṛ', 'ṝ', 'ḷ', 'e', 'ai', 'o', 'au', 'k', 'kh', 'g', 'gh', 'ṅ', 'c', 'ch', 'j', 'jh', 'ñ', 'ṭ', 'ṭh', 'ḍ', 'ḍh', 'ṇ', 't', 'th', 'd', 'dh', 'n', 'p', 'ph', 'b', 'bh', 'm', 'y', 'r', 'l', 'v', 'ś', 'ṣ', 's', 'h', 'ḥ', 'ṃ'],
  exec: function(tid, idx, type){
    var table = document.getElementById(tid);
    var tbody = table.getElementsByTagName('tbody')[0];
    var rows = tbody.getElementsByTagName('tr');
    var sbody = document.createElement('tbody');
    var maxCounter = 0;
    for(var i=0; i<rows.length; i++){
      var text = rows[i].getElementsByTagName('td')[idx].textContent.trim();
      let counter = 0;
      for(var index = 0; index < text.length; index++){
        if(this.characters.includes(text.charAt(index))){
          counter++;
        }
      }
      if(counter > maxCounter){
        maxCounter = counter;
      }
    }
    // Save array
    var srows = new Array();
    for(var i=0; i<rows.length; i++){
      var celValue = rows[i].getElementsByTagName('td')[idx].textContent.trim();
      var celIndex;
      if(type == 'str') {
        celIndex = isNaN(celValue) ? celValue : parseFloat(celValue);
      } else if (type == 'num') {
        celIndex = parseFloat(celValue);
      } else if (type == 'skt') {
        celIndex = this.convertToNumber(celValue).toString();
        if(celIndex.length < maxCounter * 2){
          var max = (maxCounter * 2) - celIndex.length;
          for(var index = 0; index < max; index++){
            celIndex = celIndex + '0';
          }
        }
      }
      console.log(celIndex,celIndex)
      srows.push({
        row: rows[i],
        cel: celIndex,
        idx: i
      });
    }
    
    // Sort array
    srows.sort(function(a, b){
      if(type == 'str')
        return a.cel > b.cel ? 1 : -1;
      else
        return a.cel - b.cel;
    });
    if(this.flag == 1) srows.reverse();
    
    // Replace
    for(var i=0; i<srows.length; i++){
      sbody.appendChild(srows[i].row);
    }
    table.replaceChild(sbody, tbody);
    this.replaceText(table, idx);
    
    // Set flag
    this.flag = this.flag > 0 ? 0 : 1;
  },
  
  convertToNumber: function(text) {
    let num;
    let textNumber='';
    for(var index = 0; index < text.length; index++){
      if(this.characters.includes(text.charAt(index))){
        for(var ch = 0; ch < this.characters.length; ch++){
          if(this.characters[ch].charAt(0) == text.charAt(index)){
            if(this.characters[ch].length == 2){
              if(this.characters[ch].charAt(1) == text.charAt(index+1)){
                num = ch + 1;
                index++;
              }
            }else{
              num = ch + 1;
            }
          }
        }
        num = num.toString();
        if(num.length == 1){
          num = '0' + num;
        }
        textNumber = textNumber + num;
      }
    }
    return parseInt(textNumber);
  },
  
  replaceText: function(table, idx){
    var thead = table.getElementsByClassName('theadtext');
    
    // Preset header-text
    if(!this.exp){
      this.text = new Array();
      for(var i=0; i<thead.length; i++){
        this.text.push(thead[i].firstChild.nodeValue);
      }
      this.exp = 1;
    }
    
    // Set & remove suffix
    for(var i=0; i<thead.length; i++){
      if(i == idx){
        thead[i].firstChild.nodeValue = this.flag == 0
          ? this.text[i] + this.suffix[0]
          : this.text[i] + this.suffix[1];
      }
      else {
        thead[i].firstChild.nodeValue = this.text[i];
      }
    }
  },
  
  suffix: ['▽', '△'],
  flag: 0
};
