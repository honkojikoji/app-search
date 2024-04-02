const characters = ['a', 'ā', 'i', 'ī', 'u', 'ū', 'ṛ', 'ṝ', 'ḷ', 'e', 'ai', 'o', 'au', 'k', 'kh', 'g', 'gh', 'ṅ', 'c', 'ch', 'j', 'jh', 'ñ', 'ṭ', 'ṭh', 'ḍ', 'ḍh', 'ṇ', 't', 'th', 'd', 'dh', 'n', 'p', 'ph', 'b', 'bh', 'm', 'y', 'r', 'l', 'v', 'ś', 'ṣ', 's', 'h', 'ḥ', 'ṃ'];

let num;
let textNumber='';
for(var index = 0; index < text.length; index++){
  if(characters.includes(text.charAt(index))){
    for(var ch = 0; ch < characters.length; ch++){
      if(characters[ch].charAt(0) == text.charAt(index)){
        if(characters[ch].length == 2){
          if(characters[ch].charAt(1) == text.charAt(index+1)){
            num = ch + 1;
            index++;
          }
        }else{
          num = ch + 1;
        }
      }
    }
    num = num.toString();
    console.log('index:',index,'num:',num)
    if(num.length == 1){
      num = '0' + num;
    }
    textNumber = textNumber + num;
  }
}
console.log(textNumber)