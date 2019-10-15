const dotenv = require('dotenv')
dotenv.config();
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const salesforceAdvertisementBaseUrl = process.env.salesforce_advertisement_base_url;

async function buildCsv(advertisements, advertisementBaseDirectory) {
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

  module.exports = {
      buildCsv
  }