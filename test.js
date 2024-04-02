const x = "example"; // 例として "example" を使用


const array = [];

for (let i = 0; i < x.length; i++) {
  const extractedChar = x.slice(-1 * (i + 1));
  resultArray.unshift(extractedChar);
}

console.log(resultArray); 