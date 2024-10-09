// utils/generatePDF.js
const puppeteer = require('puppeteer');
const path = require('path');

async function generateTicketPDF(booking, movie, screen) {

      const formatDate = (isoDateString) => {
        const date = new Date(isoDateString);
        return new Intl.DateTimeFormat('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }).format(date);
    };

    const formatTime = (time) => {
        if (!time) {
            console.error('Invalid time input');
            return '';
        }
    
        const [hour, minute] = time.split(':');
        
        if (hour === undefined || minute === undefined) {
            console.error('Invalid time format');
            return '';
        }
        
        const date = new Date();
        date.setHours(parseInt(hour, 10));
        date.setMinutes(parseInt(minute, 10));
    
        let hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    
        return `${hours}:${minutesStr} ${ampm}`;
    }

  // Define the HTML template with styles and booking details
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Movie Ticket</title>
      <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0px;
        }
    
        .main-cont{
            display: flex;
            justify-content: flex-start;
            flex-direction: column;
            align-items: center;
            width: 210mm;
            height: 280mm;
            box-sizing: border-box;
            padding:20px
        }


        .ticket-div{
            background-color: white;
            height: 100%;
            width:100%;
            padding: 20px;
            border-radius: 20px;
        }



        .ticket-div .details-div{
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
        }

        .details-div .movie-div{
            display: flex;
            height: 30%;
            padding-bottom: 30px;
            border-bottom: 2px dashed black;;
        }
        .movie-div img{
            border-radius: 10px;
        }
        .movie-div .details{
            display: block;
            margin-left: 20px;
        }
        .movie-div .details p{
            color: black;
            margin: 10px;
        }
        .movie-div{
            height: 100%;
        }

        .qr-div{
            display: flex;
            align-items: center;
            margin-top: 20px;
            display: flex;
            padding: 10px;
            height: 30%;
            background-color: #e5e5e5;
            border-radius: 20px;

        }
        .qr-div .details{
            margin-left: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
            justify-content: center;
        }

        .info-div{
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex: 1;
        }
        .info-div p{
            font-size: 1em;
            text-align: center;
            font-size: large;
            font-family: sans-serif;
        }

        .info-div button{
            background-color: var(--col1);
            color: white;
            border: none;
            justify-content: center;
            margin-top: 30px;
            border-radius: 4px;
            height: 50px;
            width: fit-content;
            padding: 5px 10px;
            cursor: pointer;
            text-decoration: none;
        }

        .bookId{
            margin-top: 20px;
            font-weight: bold;
            color: black;
        }
        .bookId span{
            font-weight: lighter;
        }
        .info-div .amount-div{
            display: flex;
            justify-content: center;
            border-radius: 15px;
            width: 90%;
            font-weight: bold;
        }
        .info-div p{
            margin-top: 10px;
        }
        body h1{
        font-size: 40px;
        }
        body p{
        font-size: 20px;
        }
      </style>
    </head>
    <body>
      <div class='main-cont'>
                <div class='ticket-div'>
                    <div class="details-div">
                        <div class="movie-div">
                            <img src=${movie.portraitImgUrl} alt='' height="300" width="250"/>
                            <div class="details">
                                <h1>${movie.title}</h1>
                                <p>${screen.screenType}</p>
                                <p>${formatDate(booking.showDate)} | ${formatTime(booking.showTime)}</p>
                                <p>${screen.location} | ${screen.city}</p>
                            </div>
                        </div>
                        <div class="qr-div">
                            <img src=${booking.qrCode} alt='qr' height="280" width="280"/>
                            <div class="details">
                                <p>${booking.seats.length} Ticket(s)</p>
                                <h1>${screen.name}</h1>
                                <p>
                                ${booking.seats.map((seat)=>`
                                     ${seat.row}${seat.col}${seat.seat_id}
                                `)}
                                </p>
                                <p class='bookId'>Booking Id: <span>${booking._id}</span></p>
                            </div>
                        </div>
                        <div class="info-div">
                            <div class='amount-div'>Total Amount <span>:  Rs.${booking.totalPrice}</span></div>
                            <p>Thank you for booking your movie tickets with us! 🎉✨<br>
                                Enjoy the show! 🍿🎬<br></p>
                        </div>
                    </div>
                </div>
            </div>
    </body>
    </html>
  `;

  // Launch Puppeteer and generate PDF
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Set HTML content and wait for it to load completely
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

  // Convert to PDF
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  return pdfBuffer;
}

module.exports = { generateTicketPDF };
