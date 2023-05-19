const eventController = {}
const db = require('../modules/mongodb');
const fs = require('fs')
const { ObjectId } = require('mongodb');
const collectionName = 'events'
const mysql = require('mysql')
const moment = require('moment');
const utils = require('util')
const connection = mysql.createConnection({
  host: "localhost",
  user: 'root',
  password: 'admin',
  database: 'newDB'
})
// GET: getting all the events, query page, limit and sort are accepted 

connection.connect(function (err) {
  if (err) {
    console.log('can not connect to dataabase');
    return
  }
  console.log('connected to database');
})

eventController.get = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 100;
  const sort = req.query.sort === 'older' ? 'ASC' : 'DESC';
  const Id = parseInt(req.query.Id) || undefined;

  if (Id && !Number.isInteger(Id)) {
    return res.status(400).json({ message: "Invalid Id parameter passed" });
  }

  let keys = `type = "event"`

  if (Id) {
    keys += `AND id = ${Id}`
  }

  const countQuery = 'SELECT COUNT(*) AS totalCount FROM newTable WHERE type = "event"'
  const query = `SELECT * FROM newTable 
  WHERE ${keys} 
  ORDER BY createdAt ${sort}
  LIMIT ${limit} 
  OFFSET ${(page > 0 ? (page - 1) : 0) * limit}
  `


  connection.query(countQuery, function (err, count) {

    if (err) return res.status(500).json('Internal serval error')

    const totalCount = count[0].totalCount

    connection.query(query, function (err, responses) {

      if (err) return res.status(500).json('Internal serval error')

      const totalPages = Math.ceil(totalCount / limit)

      return res.status(200).json({
        responses,
        totalCount,
        totalPages
      })
    })

  })
}


//  POST: for creating the event. using checkrequired if we don't find it give the error
eventController.create = async (req, res) => {
  const { name, tagline, schedule, description, moderator, category, sub_category, rigor_rank, attendees } = req.body;
  const uid = parseInt(req.uid);

  const formattedDate = moment(schedule).format('YYYY:MM:DD HH:MM:SS')

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS newTable (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      tagline VARCHAR(255),
      description VARCHAR(255),
      category VARCHAR(255),
      sub_category VARCHAR(255),
      rigor_rank INT,
      attendees JSON,
      schedule TIMESTAMP ,
      moderator INT,
      uid INT,
      createdAt TIMESTAMP,
      
      type VARCHAR(50) DEFAULT 'event'
    )
  `;

  connection.query(createTableQuery, (err, result) => {
    if (err) {
      console.error('Error creating table:', err);
      return res.status(500).json('Internal Server Error');
    }

    const eventData = {
      name,
      tagline,
      schedule: formattedDate,
      description,
      moderator,
      category,
      sub_category,
      rigor_rank,
      attendees,
      uid,
      createdAt: new Date()
    };

    const insertQuery = 'INSERT INTO newTable SET ?';
    connection.query(insertQuery, eventData, (err, result) => {
      if (err) {
        console.error('Error inserting data into newTable:', err);
        return res.status(500).json('Internal Server Error after creating table');
      }

      res.status(200).json('Data created successfully');
    });
  });
};

// UPDATING THE VALUES
eventController.edit = async (req, res) => {
  const id = parseInt(req.params.Id);
  const uid = parseInt(req.uid);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ message: 'Invalid Id passed' });
  }

  const addColumnQuery = 'ALTER TABLE newTable ADD COLUMN (updatedBy INT, updatedAt TIMESTAMP)';
  const updateQuery = 'UPDATE newTable SET ? WHERE id = ? AND uid = ? AND type = "event"';

  const payload = {};
  const values = [];

  for (let [key, value] of Object.entries(req.body)) {
    if (value !== undefined && value !== '' && value !== null) {
      payload[key] = value;
    }
  }

  if (Object.keys(payload).length) {
    payload.updatedAt = new Date();
    payload.updatedBy = uid;

    try {
      if (req.file) {
        const imageDocument = {
          name: Date.now() + '--' + req.file.originalname,
          contentType: req.file.mimetype,
          // file: fs.readFileSync(req.file.path)
        };
        payload.image = imageDocument;
      }

      // Execute the ALTER TABLE query to add the new columns if not already added
      connection.query(addColumnQuery, (err) => {
        if (err) {
          console.error('Error adding columns:', err);
          return res.status(500).json('Internal Server Error');
        }

        // Execute the UPDATE query to update the row with the new data
        values.push(payload, id, uid);
        connection.query(updateQuery, values, (err, result) => {
          if (err) {
            console.error('Error updating data:', err);
            return res.status(500).json('Internal Server Error');
          }

          if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Event not found' });
          }

          return res.status(200).json({ message: 'Data updated successfully' });
        });
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'An error occurred while updating the event' });
    }
  } else {
    return res.status(400).json({ message: 'No changes detected' });
  }
};



eventController.delete = async (req, res) => {
  try {
    const id = parseInt(req.params.Id);
    const uid = parseInt(req.uid);

    const keys = `id = ${id} AND uid = ${uid} AND type = "event"`

    const query = `DELETE FROM newTable WHERE ${keys}`



    connection.query(query, function (err, result) {
      if (err) return res.status(500).json('Internal Server Error');

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'No data found' });
      }


      return res.status(200).json({
        message: 'Data Deleted Successfully',
        result
      });
    })
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'An error occurred while deleting the event' });
  }
};

module.exports = eventController