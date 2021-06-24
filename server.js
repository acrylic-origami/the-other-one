const express = require('express');
	const app = express();
const Q = require('q');
const { OrderedMap } = require('immutable');
const { pool } = require('./pg');
const multer = require('multer');

// const target = 'if only this damn application were easier to program, then i\'d be rolling in it alas too many cities';

const bodyParser = require("body-parser");
// app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static('public'));
app.listen(8090);

// DP
// psql.query('CREATE TEMPORARY TABLE tph (p VARCHAR(64), n SERIAL PRIMARY KEY);')
// 	.then(_ => psql.query('INSERT INTO tph VALUES %L', target.split(' ')))
// 	.then(_ => psql.query('SELECT * FROM tph'))

function rethrow(msg) {
	return e => { console.log(e); throw new Error(msg); };
}
const N_MAX = 128;
app.post('/q', multer().none(), (req, res) => {
	function fail_req(e) {
		console.log(e);
		res.status(501).send(e.message);
	}
	pool.connect()
	    .then(psql => {
				function fail(e) {
					psql.release();
					fail_req(e);
				}
				const term0 = req.body.term.replace(/[^\w\-\' ]/g, '').replace(/ {2,}/g, ' ');
				console.log(term0);
				if(term0.length > N_MAX) {
					fail(new Error(`Name too long (>${N_MAX} chars, hard to tweet about)`));
				}
				else {
		    	console.log('P: ', Date.now(), term0);
		    	return psql.query({
		    		text: `
			    		SELECT p.geonameid, n0.name AS place_name, p.pop, p.lat, p.lon, a1.name AS admin1_name, p.country_code, c.name AS country_name
			    			FROM places p
			    			INNER JOIN names n0 ON n0.geonameid = p.geonameid
			    			LEFT JOIN admin1 a1 ON a1.code = CONCAT(p.country_code, '.', p.admin1)
			    			LEFT JOIN countries c ON c.code = p.country_code
			    			WHERE p.feature_class = 'P'
			    				AND n0.name ILIKE $1
			    			ORDER BY p.pop DESC
						`,
		    		values: [term0],
		    		// rowMode: 'array'
		    	})
		    		.then(r => {
		    			res.send(r.rows);
		    			psql.release();
		    		})
		    		.catch(fail)
		    }
	  	}, fail_req)
	  	.catch(fail_req)
});
