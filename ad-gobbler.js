var jsforce = require('jsforce');
const http = require('https');
const fs = require('fs');
const cheerio = require('cheerio')
const axios = require('axios')
const dotenv = require('dotenv')
dotenv.config();
const sql = require('mssql')
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const salesforceAdvertisementBaseUrl = process.env.salesforce_advertisement_base_url;
const advertisementBaseDirectory= `advertisements`;

const query = `SELECT Id, Advertising_Type__c, Type__c, Advertisement_Created__c,Marketing_to_use__c, Account_Manager__c,Auction_ID__c, Account_Name__c, Account_Name__r.Name, Account_Name__r.Auction_House_Id__c,Opportunity__r.Auction_Title__c, Opportunity__r.Estimated_Time_Of_Start__c,
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
        fs.mkdirSync(directory,{recursive: true})
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


async function buildCsv(advertisements) {
  const csvWriter = createCsvWriter({
    path: 'InDesign.csv',
    header: [
      {id: 'salesforceAdvertisementUrl', title: 'SalesforceAdvertisementURL'},
      {id: 'marketingToUse', title: 'marketingToUse' },
      {id: 'name', title: 'ClientName'},
      {id: 'AuctionTitle', title: 'AuctionTitle'},
      {id: 'City', title: 'City'},
      {id: 'State', title: 'State'},
      {id: 'Ends', title: 'Ends'},
      {id: 'Month', title: 'Month'},
      {id: 'MonthAbbreviation', title: 'MonthAbbreviation'},
      {id: 'DayOfMonth', title: 'DayOfMonth'},
      {id: 'DayOfWeek', title: 'DayOfWeek'},
      {id: 'DayOfWeekAbbreviation', title: 'DayOfWeekAbbreviation'},
      {id: 'Time', title: 'Time'},
      {id: 'AMPM', title: 'AMPM'},
      {id: 'TimeZone', title: 'TimeZone'},
      {id: 'image1', title: '@image1'},
      {id: 'image2', title: '@image2'},
      {id: 'image3', title: '@image3'},
      {id: 'image4', title: '@image4'},
      {id: 'logo', title: '@image-logo'},
    ]
  });
  let records = [];
  return new Promise((resolve, reject)=>{
    try{
      if(!advertisements.length){
        return resolve();
      }
      fs.writeFileSync(`InDesign.csv`, "ClientName, AuctionTitle, City, State, Month, DayOfMonth, DayOfWeek, Time, AMPM, TimeZone, @image1, @image2, @image3, @image4, @image-logo");
      advertisements.forEach((advertisement)=>{
        let directory = `${advertisementBaseDirectory}/${advertisement.cleanedAuctionHouseName}-${advertisement.Id}`;
        let month;
        let dayOfWeek;
        let dayOfMonth;
        let hour;
        let ampm;
        let minute;
        if(advertisement.isTimed){
          month= advertisement.auctionEndTime.month;
          monthAbbreviation = advertisement.auctionEndTime.monthAbbreviation;
          dayOfWeek = advertisement.auctionEndTime.dayOfWeek;
          dayOfWeekAbbreviation = advertisement.auctionEndTime.dayOfWeekAbbreviation;
          dayOfMonth = advertisement.auctionEndTime.dayOfMonth;
          hour = advertisement.auctionEndTime.hour24%12 == 0 ? 12:advertisement.auctionEndTime.hour24%12;
          ampm = advertisement.auctionEndTime.hour24 > 12? 'pm':'am';
          minute = advertisement.auctionEndTime.minute;
        }else {
          month= advertisement.auctionStartTime.month;
          monthAbbreviation = advertisement.auctionStartTime.monthAbbreviation;
          dayOfWeek = advertisement.auctionStartTime.dayOfWeek;
          dayOfWeekAbbreviation = advertisement.auctionStartTime.dayOfWeekAbbreviation;
          dayOfMonth = advertisement.auctionStartTime.dayOfMonth;
          hour = advertisement.auctionStartTime.hour24%12 == 0 ? 12:advertisement.auctionStartTime.hour24%12;
          ampm = advertisement.auctionStartTime.hour24 > 12? 'pm':'am';
          minute = advertisement.auctionStartTime.minute;
        }
        const city = advertisement.auctionLocation.city;
        const state = advertisement.auctionLocation.state;
        const timezone = advertisement.auctionStartTime.timezone;
        if (!fs.existsSync(directory)) {
          fs.mkdirSync(directory, {recursive: true});
        }
        records.push(
          {
            salesforceAdvertisementUrl: `${salesforceAdvertisementBaseUrl}/${advertisement.Id}`,
            marketingToUse: advertisement.Marketing_to_use__c,
            name: advertisement.Account_Name__r.Name,
            AuctionTitle: advertisement.Opportunity__r.Auction_Title__c,
            City: city,
            State: state,
            Ends: advertisement.isTimed?"Ends":"",
            Month: month,
            MonthAbbreviation: monthAbbreviation,
            DayOfMonth: dayOfMonth,
            DayOfWeek:dayOfWeek,
            DayOfWeekAbbreviation: dayOfWeekAbbreviation,
            Time: `${hour}:${minute}`,
            AMPM: ampm,
            TimeZone: timezone,
            image1: `./${directory}/lot1.jpg`,
            image2: `./${directory}/lot2.jpg`,
            image3: `./${directory}/lot3.jpg`,
            image4: `./${directory}/lot4.jpg`,
            logo: `./${directory}/logo.jpg`,
          }
        )
      })
      csvWriter.writeRecords(records).then(()=>{
        console.log('...Done');
        return resolve(`Successfully build CSV`)
      });
    }catch(error){
      console.log(error);
      return reject(`Error building CSV: ${error}`);
    }
  })
}

async function queryAuctionInformation(auctionId){
  const result = await sql.query`select * from proxibid_reporting.dbo.Auctions 
  join proxibid_reporting.dbo.TimeZoneLU on Auctions.TimeZoneID = TimeZoneLU.TimeZoneID 
  join proxibid_reporting.dbo.StateLU on Auctions.StateID = StateLU.StateID where AuctionID = ${auctionId}`

  const auction = result.recordsets[0][0];
  const auctionStreetAddress = auction.StreetAddress;
  const auctionCity = auction.Location;
  const auctionState = auction.AbbreviationTx;
  const auctionTimeZone = auction.Abbreviation;
  const isTimed = auction.AuctionTypeId == 2;

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let auctionInformation = {};
  auctionInformation.location = {
    streetAddress: auctionStreetAddress,
    city: auctionCity,
    state: auctionState,
  };
  auctionInformation.startTime = {
    dayOfMonth: auction.AuctionDate.getUTCDate(),
    dayOfWeek: daysOfWeek[auction.AuctionDate.getUTCDay()],
    dayOfWeekAbbreviation: daysOfWeek[auction.AuctionDate.getUTCDay()].substring(0,3),
    month: auction.AuctionDate.getMonthName(),
    monthAbbreviation: auction.AuctionDate.getMonthAbbr(),
    year: auction.AuctionDate.getUTCFullYear(),
    hour24: auction.AuctionTime.getUTCHours(),
    minute: auction.AuctionTime.getUTCMinutes().toString().padStart(2, '0'),
    timezone: auctionTimeZone
  }
  auctionInformation.isTimed = isTimed;
  if(isTimed){
    auctionInformation.endTime = {
      dayOfMonth: auction.EndDateTime.getUTCDate(),
      dayOfWeek: daysOfWeek[auction.EndDateTime.getUTCDay()],
      dayOfWeekAbbreviation: daysOfWeek[auction.EndDateTime.getUTCDay()].substring(0,3),
      month: auction.EndDateTime.getMonthName(), 
      monthAbbreviation: auction.EndDateTime.getMonthAbbr(),
      year: auction.EndDateTime.getUTCFullYear(),
      hour24: auction.EndDateTime.getUTCHours(),
      minute: auction.EndDateTime.getUTCMinutes().toString().padStart(2, '0'),
      timezone: auctionTimeZone
    }
  }
  return auctionInformation;
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
    const cleanedAuctionHouseName = advertisement.Account_Name__r.Name.replace(/'|,|"|\./g, '').replace(/\s|\//g, '-')
    advertisement.cleanedAuctionHouseName = cleanedAuctionHouseName;
    const directory = `${advertisementBaseDirectory}/${advertisement.cleanedAuctionHouseName}-${advertisement.Id}`;
    try {
      console.log(JSON.stringify(advertisement));
      await downloadLogo(advertisement.Account_Name__r.Auction_House_Id__c,  directory,"logo.jpg")

      if(isJpegURL(advertisement.Lot_1_Web_Address__c)){
        await downloadImage(advertisement.Lot_1_Web_Address__c, directory, "lot1.jpg");
      }else {
        await downloadFirstLotImage(advertisement.Lot_1_Web_Address__c, directory, "lot1.jpg")
      }

      if(isJpegURL(advertisement.Lot_2_Web_Address__c)){
        await downloadImage(advertisement.Lot_2_Web_Address__c, directory, "lot2.jpg");
      }else {
        await downloadFirstLotImage(advertisement.Lot_2_Web_Address__c, directory, "lot2.jpg")
      }

      if(isJpegURL(advertisement.Lot_3_Web_Address__c)){
        await downloadImage(advertisement.Lot_3_Web_Address__c, directory, "lot3.jpg");
      }else{
        await downloadFirstLotImage(advertisement.Lot_3_Web_Address__c, directory, "lot3.jpg")
      }

      if(isJpegURL(advertisement.Lot_4_Web_Address__c)){
        await downloadImage(advertisement.Lot_3_Web_Address__c, directory, "lot3.jpg");
      }else{
        await downloadFirstLotImage(advertisement.Lot_4_Web_Address__c, directory, "lot4.jpg")
      }

      const auctionInformation = await queryAuctionInformation(advertisement.Auction_ID__c)
      advertisement.auctionLocation = auctionInformation.location;
      advertisement.auctionStartTime = auctionInformation.startTime;
      advertisement.auctionEndTime = auctionInformation.endTime;
      advertisement.isTimed = auctionInformation.isTimed;
      succesfulAdvertisements.push(advertisement);
    } catch (error) {
      console.log(error)
      failedAdvertisements.push(`${process.env.salesforce_advertisement_base_url}/${advertisement.Id}: ${error}`);
    }
  }
  const buildCsvResult = await buildCsv(succesfulAdvertisements)
  console.log(buildCsvResult)
  sql.close()
  console.log(`All dones`)
  console.log(`Failed Advertisements: ${JSON.stringify(failedAdvertisements)}`)
})();