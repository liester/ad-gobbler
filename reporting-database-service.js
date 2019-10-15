const sql = require('mssql')
const dotenv = require('dotenv')
dotenv.config();

async function connectToReportingDatabase() {
    const database_user = process.env.reporting_database_user;
    const database_password = process.env.reporting_database_password;
    const config = {
        user: database_user,
        password: database_password,
        server: `rptdb`, // You can use 'localhost\\instance' to connect to named instance
        database: `proxibid_reporting`,
    }
    await sql.connect(config)
}

async function queryAuctionInformation(auctionId) {
    await connectToReportingDatabase();
    const result = await sql.query`select *, AuctionHouses.LogoFileName as 'AuctionHouseLogo' from proxibid_reporting.dbo.Auctions
    join proxibid_reporting.dbo.TimeZoneLU on Auctions.TimeZoneID = TimeZoneLU.TimeZoneID
    join proxibid_reporting.dbo.StateLU on Auctions.StateID = StateLU.StateID
    join proxibid_reporting.dbo.AuctionHouses on Auctions.AuctionHouseID = AuctionHouses.AuctionHouseID
    where AuctionID = ${auctionId}`

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
        dayOfWeekAbbreviation: daysOfWeek[auction.AuctionDate.getUTCDay()].substring(0, 3),
        month: auction.AuctionDate.getMonthName(),
        monthAbbreviation: auction.AuctionDate.getMonthAbbr(),
        year: auction.AuctionDate.getUTCFullYear(),
        hour24: auction.AuctionTime.getUTCHours(),
        minute: auction.AuctionTime.getUTCMinutes().toString().padStart(2, '0'),
        timezone: auctionTimeZone
    }
    auctionInformation.isTimed = isTimed;
    auctionInformation.auctionHouseLogoFileName = auction.AuctionHouseLogo;
    if (isTimed) {
        auctionInformation.endTime = {
            dayOfMonth: auction.EndDateTime.getUTCDate(),
            dayOfWeek: daysOfWeek[auction.EndDateTime.getUTCDay()],
            dayOfWeekAbbreviation: daysOfWeek[auction.EndDateTime.getUTCDay()].substring(0, 3),
            month: auction.EndDateTime.getMonthName(),
            monthAbbreviation: auction.EndDateTime.getMonthAbbr(),
            year: auction.EndDateTime.getUTCFullYear(),
            hour24: auction.EndDateTime.getUTCHours(),
            minute: auction.EndDateTime.getUTCMinutes().toString().padStart(2, '0'),
            timezone: auctionTimeZone
        }
    }
    sql.close();
    return auctionInformation;
}

module.exports = {
    queryAuctionInformation
}