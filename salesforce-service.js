var jsforce = require('jsforce');

const query = `SELECT Id, Advertising_Type__c, Type__c, Advertisement_Created__c,Marketing_to_use__c, Account_Manager__c,Auction_ID__c, Account_Name__c, Account_Name__r.Name, Account_Name__r.Auction_House_Id__c,Opportunity__r.Auction_Title__c, Opportunity__r.Estimated_Time_Of_Start__c,
Lot_1__c, Lot_2__c,Lot_3__c,Lot_4__c,Lot_1_Web_Address__c, Lot_2_Web_Address__c, Lot_3_Web_Address__c, Lot_4_Web_Address__c, Start_Date__c 
FROM Advertising__c
where Advertising_Type__c != 'Homepage' 
  and Type__c = 'Slider - 740x320 pixels'
  and Advertisement_Created__c = False
  and (Start_Date__c = NEXT_N_DAYS:6 OR Start_Date__c <= TODAY)`;

function querySalesforce(){
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

module.exports = {
    querySalesforce
}