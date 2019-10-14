var jsforce = require('jsforce');
const http = require('https');
const fs = require('fs');
const cheerio = require('cheerio')
const axios = require('axios')
const dotenv = require('dotenv')
const sql = require('mssql')
dotenv.config();

const query = `SELECT Id, Advertising_Type__c, Type__c, Advertisement_Created__c, Account_Manager__c,Auction_ID__c, Account_Name__c, Account_Name__r.Name, Account_Name__r.Auction_House_Id__c,Opportunity__r.Auction_Title__c, Opportunity__r.Estimated_Time_Of_Start__c,
Lot_1__c, Lot_2__c,Lot_3__c,Lot_4__c,Lot_1_Web_Address__c, Lot_2_Web_Address__c, Lot_3_Web_Address__c, Lot_4_Web_Address__c, Start_Date__c 
FROM Advertising__c
where Advertising_Type__c != 'Homepage' 
  and Type__c = 'Slider - 740x320 pixels'
  and Advertisement_Created__c = False
  and (Start_Date__c = NEXT_N_DAYS:6 OR Start_Date__c <= TODAY)`;

function querySalesforce(query){
  var conn = new jsforce.Connection({
    loginUrl: process.env.salesforce_loginUrl
  });
  return new Promise((resolve, reject)=>{
    conn.login(process.env.salesforce_username, process.env.salesforce_password, (error, response)=>{
      if(error) {
        console.log(JSON.stringify(`Error connecting to Salesforce: ${error}`));
        return reject(error)
      }
      conn.query(query, function (error, response) {
        if (error) { 
          console.error(error); 
          return reject(error);
        }
        return resolve(response.records)
      });
    })
  })
}

function downloadImage(url, directory, fileName) {
  return new Promise((resolve, reject)=>{
    if (!url) {
      console.log(`No URL provided for ${fileName}`)
      return resolve()
    } 
    console.log(`Downloading image url for: ${fileName} - URL: ${url}`)
    http.get(url, function (response) {
      if(!fs.existsSync(directory)){
        fs.mkdirSync(directory)
      }
      const file = fs.createWriteStream(`${directory}/${fileName}`);
      response.pipe(file);
      return resolve()
    });
  })
}

async function downloadLogo(auctionHouseId, directory, fileName) {
  console.log(`Downloading logo for auction house id: ${auctionHouseId}`)
  return new Promise((resolve, reject)=>{
    if (!auctionHouseId) {
      console.log(`No URL provided for ${fileName}`)
      return resolve()
    } 
    const url = `https://www.proxibid.com/asp/AuctionsByCompany.asp?ahid=${auctionHouseId}`
    axios.get(url).then((response) => {
      const $ = cheerio.load(response.data)
      const auctionImageUrl = $('.aucCompanyImage')[0].attribs.src;
      downloadImage(auctionImageUrl, directory, fileName).then(()=>{
        return resolve()
      })
    }).catch(error=>{ 
      console.log(error)
      return reject(`Error downloading logo for auction house id: ${auctionHouseId}: ${error}`)
    })
  })
}


function buildCsv(advertisements) {
  return new Promise((resolve, reject)=>{
    try{
      if(!advertisements.length){
        return resolve();
      }
      fs.writeFileSync(`InDesign.csv`, "ClientName, AuctionTitle, City, State, Date, Time, AMPM, TimeZone, @image1, @image2, @image3, @image4, @image-logo");
      advertisements.forEach((advertisement)=>{
        const month= advertisement.auctionStartTime.month;
        const day = advertisement.auctionStartTime.day
        const hour = advertisement.auctionStartTime.hour24%12 == 0 ? 12:advertisement.auctionStartTime.hour24%12;
        const ampm = advertisement.auctionStartTime.hour24 > 12? 'pm':'am';
        const minute = advertisement.auctionStartTime.minute;
        const city = advertisement.auctionLocation.city;
        const state = advertisement.auctionLocation.state;
        const timezone = advertisement.auctionStartTime.timezone;
        if (!fs.existsSync(advertisement.Id)) {
          fs.mkdirSync(advertisement.Id);
        }
        fs.appendFileSync(`InDesign.csv`, `\n${advertisement.Account_Name__r.Name}, ${advertisement.Opportunity__r.Auction_Title__c}, ${city}, ${state}, ${month}/${day}, ${hour}:${minute}, ${ampm}, ${timezone}, ./${advertisement.Id}/lot1.jpg, ./${advertisement.Id}/lot2.jpg, ./${advertisement.Id}/lot3.jpg, ./${advertisement.Id}/lot4.jpg, ./${advertisement.Id}/logo.jpg`);
      })
      return resolve(`Successfully build CSV`)
    }catch(error){
      console.log(error);
      return reject(`Error building CSV: ${error}`);
    }
  })
}

async function queryAuctionLocationAndStartTime(auctionId){
  const result = await sql.query`select * from proxibid_reporting.dbo.Auctions 
  join proxibid_reporting.dbo.TimeZoneLU on Auctions.TimeZoneID = TimeZoneLU.TimeZoneID 
  join proxibid_reporting.dbo.StateLU on Auctions.StateID = StateLU.StateID where AuctionID = ${auctionId}`

  const auction = result.recordsets[0][0];
  const auctionStreetAddress = auction.StreetAddress;
  const auctionCity = auction.Location;
  const auctionState = auction.AbbreviationTx;
  const auctionTimeZone = auction.Abbreviation;

  return {
    location: {
      streetAddress: auctionStreetAddress,
      city: auctionCity,
      state: auctionState,
    },
    startTime: {
      day: auction.AuctionDate.getUTCDate(),
      month: auction.AuctionDate.getUTCMonth()+1, //0 index month
      year: auction.AuctionDate.getUTCFullYear(),
      hour24: auction.AuctionTime.getUTCHours(),
      minute: auction.AuctionTime.getUTCMinutes().toString().padStart(2, '0'),
      timezone: auctionTimeZone
    }
  }
}

async function connectToReportingDatabase(){
  const database_user = process.env.reporting_database_user;
  const database_password = process.env.reporting_database_password;
  // await sql.connect(`jdbc:sqlserver://rptdb;databaseName=proxibid_reporting;user=${database_user};password=${database_password}`);
  const config = {
    user: database_user,
    password: database_password,
    server: `rptdb`, // You can use 'localhost\\instance' to connect to named instance
    database: `proxibid_reporting`,
  }
  await sql.connect(config)
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
        downloadImage(lotImageUrl, directory, fileName).then(()=>{
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

function isJpegURL(url){
  const regex = /\.jpg|\.jpeg$/gm;
  const matches =  regex.exec(url);
  return !!matches;
}

(async function makeItHappen(){
  await connectToReportingDatabase()
  const advertisements = await querySalesforce(query);
  let succesfulAdvertisements = [];
  let failedAdvertisements = [];
  for( const advertisement of advertisements){
    try {
      console.log(JSON.stringify(advertisement));
      await downloadLogo(advertisement.Account_Name__r.Auction_House_Id__c,  advertisement.Id,"logo.jpg")

      if(isJpegURL(advertisement.Lot_1_Web_Address__c)){
        await downloadImage(advertisement.Lot_1_Web_Address__c, advertisement.Id, "lot1.jpg");
      }else {
        await downloadFirstLotImage(advertisement.Lot_1_Web_Address__c, advertisement.Id, "lot1.jpg")
      }

      if(isJpegURL(advertisement.Lot_2_Web_Address__c)){
        await downloadImage(advertisement.Lot_2_Web_Address__c, advertisement.Id, "lot2.jpg");
      }else {
        await downloadFirstLotImage(advertisement.Lot_2_Web_Address__c, advertisement.Id, "lot2.jpg")
      }

      if(isJpegURL(advertisement.Lot_3_Web_Address__c)){
        await downloadImage(advertisement.Lot_3_Web_Address__c, advertisement.Id, "lot3.jpg");
      }else{
        await downloadFirstLotImage(advertisement.Lot_3_Web_Address__c, advertisement.Id, "lot3.jpg")
      }

      if(isJpegURL(advertisement.Lot_4_Web_Address__c)){
        await downloadImage(advertisement.Lot_3_Web_Address__c, advertisement.Id, "lot3.jpg");
      }else{
        await downloadFirstLotImage(advertisement.Lot_4_Web_Address__c, advertisement.Id, "lot4.jpg")
      }

      const auctionLocationAndStartTime = await queryAuctionLocationAndStartTime(advertisement.Auction_ID__c)
      advertisement.auctionLocation = auctionLocationAndStartTime.location;
      advertisement.auctionStartTime = auctionLocationAndStartTime.startTime;
      succesfulAdvertisements.push(advertisement);
    } catch (error) {
      console.log(error)
      failedAdvertisements.push(`${advertisement.Id}: ${error}`);
    }
  }
  const buildCsvResult = await buildCsv(succesfulAdvertisements)
  console.log(buildCsvResult)
  sql.close()
  console.log(`All dones`)
  console.log(`Failed Advertisements: ${JSON.stringify(failedAdvertisements)}`)
})();