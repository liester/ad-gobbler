const {downloadImage} = require('./image-downloader')
const {buildCsv} = require('./csv-builder')
const {queryAuctionInformation} = require('./reporting-database-service')
const {querySalesforce} = require('./salesforce-service')
const advertisementBaseDirectory= `advertisements`;
const dotenv = require('dotenv')
dotenv.config();

(async function makeItHappen(){
  const advertisements = await querySalesforce();
  let succesfulAdvertisements = [];
  let failedAdvertisements = [];
  for( const advertisement of advertisements){
    const cleanedAuctionHouseName = advertisement.Account_Name__r.Name.replace(/'|,|"|\./g, '').replace(/\s|\//g, '-')
    advertisement.cleanedAuctionHouseName = cleanedAuctionHouseName;
    const directory = `${advertisementBaseDirectory}/${advertisement.cleanedAuctionHouseName}-${advertisement.Id}`;
    try {
      console.log(JSON.stringify(advertisement));
      const auctionInformation = await queryAuctionInformation(advertisement.Auction_ID__c)
      advertisement.auctionLocation = auctionInformation.location;
      advertisement.auctionStartTime = auctionInformation.startTime;
      advertisement.auctionEndTime = auctionInformation.endTime;
      advertisement.isTimed = auctionInformation.isTimed;
      const logoUrl = `https://images.proxibid.com/auctionimages/${advertisement.Account_Name__r.Auction_House_Id__c}/${auctionInformation.auctionHouseLogoFileName}`;

      await downloadImage(logoUrl, directory,"logo.jpg")
      await downloadImage(advertisement.Lot_1_Web_Address__c, directory, "lot1.jpg")
      await downloadImage(advertisement.Lot_2_Web_Address__c, directory, "lot2.jpg");
      await downloadImage(advertisement.Lot_3_Web_Address__c, directory, "lot3.jpg");
      await downloadImage(advertisement.Lot_4_Web_Address__c, directory, "lot4.jpg")
      succesfulAdvertisements.push(advertisement);
    } catch (error) {
      console.log(error)
      failedAdvertisements.push(`${process.env.salesforce_advertisement_base_url}/${advertisement.Id}: ${error}`);
    }
  }
  const buildCsvResult = await buildCsv(succesfulAdvertisements, advertisementBaseDirectory)
  console.log(buildCsvResult)
  console.log(`All dones`)
  console.log(`Failed Advertisements: ${JSON.stringify(failedAdvertisements)}`)
})();