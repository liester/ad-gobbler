var jsforce = require('jsforce');
const http = require('https');
const fs = require('fs');
const moment = require('moment')
const cheerio = require('cheerio')
const axios = require('axios')
const dotenv = require('dotenv')
const sql = require('mssql')
dotenv.config();

const query = `SELECT Id, Account_Manager__c,Auction_ID__c, Account_Name__c, Account_Name__r.Name, Account_Name__r.Auction_House_Id__c,Opportunity__r.Auction_Title__c, Opportunity__r.Estimated_Time_Of_Start__c,
Lot_1__c, Lot_2__c,Lot_3__c,Lot_4__c,Lot_1_Web_Address__c, Lot_2_Web_Address__c, Lot_3_Web_Address__c, Lot_4_Web_Address__c, Start_Date__c 
FROM Advertising__c
limit 1`;

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
    console.log(`Downloading image url: ${url}`)
    http.get(url, function (response) {
      if(!fs.existsSync(directory)){
        fs.mkdirSync(directory)
      }
      const file = fs.createWriteStream(`${directory}/${fileName}`);
      response.pipe(file);
      return resolve(`File ${fileName} saved`)
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
      return reject()
    })
  })
}


function buildCsv(advertisements) {
  return new Promise((resolve)=>{
    fs.writeFileSync(`InDesign.csv`, "ClientName, AuctionTitle, Date, Time, TimeZone, @image1, @image2, @image3, @image4, @image-logo");
    advertisements.forEach((advertisement)=>{
      const startDateInMilliseconds =  Date.parse(advertisement.Opportunity__r.Estimated_Time_Of_Start__c)
      const startDateMoment =  moment(startDateInMilliseconds)
      const monthDay = startDateMoment.format("M/D")
      const hourMinute = startDateMoment.format("HH:MMa")
      if (!fs.existsSync(advertisement.Id)) {
        fs.mkdirSync(advertisement.Id);
      }
      fs.appendFileSync(`InDesign.csv`, `\n${advertisement.Account_Name__r.Name}, ${advertisement.Opportunity__r.Auction_Title__c}, ${monthDay}, ${hourMinute}, CT, ./lot1.jpg, ./lot2.jpg, ./lot3.jpg, ./lot4.jpg, ./logo.jpg`);
    })
    console.log("CSV has been generated.")
    return resolve()
  })
}


async function queryAuctionLocationAndStartTime(auctionId){
  const result = await sql.query`select * from proxibid_reporting.dbo.Auctions where AuctionID = 34`

  const auctionDate = result.recordset[0].columns.AuctionDate;
  const auctionTime = result.recordset[0].columns.AuctionTime;
  const auctionStreetAddress = result.recordset[0].columns.StreetAddress;
  const auctionCit = result.recordset[0].columns.StreetAddress;

  

  return {
    location: {
      streetAddress: result.recordset[0].columns.TimeZoneID,
      city: 'Omaha',
      state: 'Nebraska'
    },
    startTime: {
      day: '11',
      month: '12',
      year: '2019',
      hour24: '13',
      minute: '00',
      timezoneId: result.recordset[0].columns.TimeZoneID
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


(async function makeItHappen(){
  await connectToReportingDatabase()
  const advertisements = await querySalesforce(query);
  for( const advertisement of advertisements){
    try {
      console.log(JSON.stringify(advertisement));
      // await downloadLogo(advertisement.Account_Name__r.Auction_House_Id__c,  advertisement.Id,"logo.jpg")
      // await downloadImage(advertisement.Lot_1_Web_Address__c, advertisement.Id, "lot1.jpg")
      // await downloadImage(advertisement.Lot_2_Web_Address__c, advertisement.Id, "lot2.jpg")
      // await downloadImage(advertisement.Lot_3_Web_Address__c, advertisement.Id, "lot3.jpg")
      // await downloadImage(advertisement.Lot_4_Web_Address__c, advertisement.Id, "lot4.jpg")
      const auctionLocationAndStartTime = await queryAuctionLocationAndStartTime(advertisement.Auction_ID__c)
      // advertisement.auctionLocation = auctionLocationAndStartTime.location;
      // advertisement.startTime = auctionLocationAndStartTime.startTime;
    } catch (error) {
      console.log(error)
    }
  }
  await buildCsv(advertisements)
  sql.close()
  console.log(`All dones`)
})();