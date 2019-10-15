
const http = require('https');
const axios = require('axios')
const fs = require('fs');

function isJpegURL(url) {
    const regex = /\.jpg|\.jpeg$/gm;
    const matches = regex.exec(url);
    return !!matches;
}


async function downloadImage(url, directory, fileName) {
    if (isJpegURL(url)) {
        await downloadImageFromUrl(url, directory, fileName);
    } else {
        await downloadFirstLotImage(url, directory, fileName)
    }
}

async function downloadFirstLotImage(lotUrl, directory, fileName){
    console.log(`Downloading first image for lot URL: ${lotUrl}`)
    return new Promise((resolve, reject)=>{
      if (!lotUrl) {
        console.log(`No URL provided for lot.`)
        return resolve()
      } 
      const url = lotUrl;
      axios.get(url).then((response) => {
        const re = new RegExp('thumbnail: "(.*)"');  //this is super horrible, please fix at earliest convienence
        const matches = response.data.match(re)
        if(matches){
          const lotImageUrl = matches[1]
          downloadImageFromUrl(lotImageUrl, directory, fileName).then(()=>{
            return resolve()
          })
        }else{
          console.log(`No image found for: ${fileName} - URL: ${lotUrl}`)
          return resolve()
        }
      }).catch(error=>{
        console.log(error)
        return reject()
      })
    })
  }


function downloadImageFromUrl(url, directory, fileName) {
    return new Promise((resolve, reject) => {
        if (!url) {
            console.log(`No URL provided for ${fileName}`)
            return resolve()
        }
        console.log(`Downloading image url for: ${fileName} - URL: ${url}`)
        http.get(url, function (response) {
            if (!fs.existsSync(directory)) {
                fs.mkdirSync(directory, { recursive: true })
            }
            const file = fs.createWriteStream(`${directory}/${fileName}`);
            response.pipe(file);
            return resolve()
        });
    })
}


module.exports = {
    downloadImage
}