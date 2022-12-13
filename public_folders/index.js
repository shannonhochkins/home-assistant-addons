/***************************************************************************************************************************
 * Include Libraries
***************************************************************************************************************************/
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

/***************************************************************************************************************************
 * Load Enviroment Values
***************************************************************************************************************************/
const PORT = process.env.PORT || 8080;
const OPTIONS = process.env.OPTIONS || "./development/options.json";

/***************************************************************************************************************************
 * Load Options File 
***************************************************************************************************************************/
const config = require(OPTIONS);

if (!(config.index instanceof Array)) config.index = [config.index];

/***************************************************************************************************************************
 * Folder/Directory Map
***************************************************************************************************************************/
const directories = {
	directories: { },
	locations: {
		global: config,
		none: { }
	},
	root: true
};

/***************************************************************************************************************************
 * Folder Inheritance
***************************************************************************************************************************/
const inheritDirectory = (folder, url) => {
	let from = directories.locations[url];
	
	if (!from) {
		console.log(`Unable to inherit location ${folder.url} from location ${url}`);
		return;
	}

	if (folder.page_401 == null) folder.page_401 = from.page_401;
	if (folder.page_402 == null) folder.page_402 = from.page_402;
	if (folder.page_403 == null) folder.page_403 = from.page_403;
	if (folder.page_404 == null) folder.page_404 = from.page_404;

	if (from.index) folder.index = [...folder.index, ...from.index];
	if (folder.request_logging == null) folder.request_logging = from.request_logging;
	if (folder.directory_listing == null) folder.directory_listing = from.directory_listing;
};

/***************************************************************************************************************************
 * Build Directory Mappings
***************************************************************************************************************************/
for (let folder of config.folders)
{
	//Validate url.
	if (!folder.url.match(/^([a-zA-z\-_0-9\/\.]+)|\*$/)) {
		console.error(`Invalid url path ${folder.url}`);
		continue;
	}

	//Validate path.
	if (!folder.path.match(/^([a-zA-z\-_0-9\/\.]+)$/)) {
		console.error(`Invalid directory path ${folder.path}`);
		continue;
	}

	let base_url = "";
	let directory = directories;

	if (folder.url != "*") {
		let parts = folder.url.split("/");

		base_url = parts.shift();
		directory = (directories.directories[base_url] || (directories.directories[base_url] = { directories : { } }));

		for (let part of parts) {
			directory = (directory.directories[part] || (directory.directories[part] = { directories : { } }));
		}
	}

	//check for duplicates.
	if (directory.path) {
		console.error(`Invalid url path ${folder.url}, can not appear more then once.`);
		continue;
	}
	
	//Default Arrays
	if (!(folder.index instanceof Array)) folder.index = [folder.index];

	//Inheritance
	if (folder.inherits == null) folder.inherits = "global";
	if (!(folder.inherits instanceof Array)) folder.inherits = [folder.inherits];
	for (from_url of folder.inherits) inheritDirectory(folder, from_url);

	//Add Error Listing
	directory.page_401 = folder.page_401;
	directory.page_402 = folder.page_402;
	directory.page_403 = folder.page_403;
	directory.page_404 = folder.page_404;

	//Add Directory
	directory.url = folder.url;
	directory.path = folder.path;
	directory.index = folder.index;
	directory.request_logging = folder.request_logging;
	directory.directory_listing = folder.directory_listing;

	//Add to locaton map.
	directories.locations[folder.url] = folder;

	console.log(`Serving ${folder.path} at :${PORT}/${folder.url != "*" ? folder.url : ""}`);
}

/***************************************************************************************************************************
 * Function place holders.
***************************************************************************************************************************/
let sendError;
let sendFile;
let sendDirectory;
let sendDirectoryListing;
let sendResult;

/***************************************************************************************************************************
 * Send Error Code to client.
***************************************************************************************************************************/
sendError = (req, res, dir, code, err) => {
	
	if (dir.request_logging) {
		console.log(`Returned Code ${code}`);
		
		if (err && err.code)
			console.log(`JS Error Code: ${err.code}`);
		else
			console.log("JS Error", err);
	};

	if (!req.error_code) {
		req.error_code = code;
		req.file_path = dir[`page_${code}`];
		if (req.file_path) return sendResult(req, res, dir);
	}

	res.writeHead(200);
	res.end(code, 'utf-8');
};

/***************************************************************************************************************************
 * Send File to client.
***************************************************************************************************************************/
sendFile = (req, res, dir) => {
	fs.readFile(req.file_path, (err, data) => {
		if (err && err.code == 'ENOENT') return sendError(req, res, dir, "404");
		if (err) return sendError(req, res, dir, "401", err);
		
		res.writeHead(200);
		res.end(data);

		if (dir.request_logging) console.log("Returned File.");
	});
};

/***************************************************************************************************************************
 * Send Directory Client.
***************************************************************************************************************************/
sendDirectory = (req, res, dir) => {
	console.log('req', req.file_path);
	fs.readdir(req.file_path, (err, files) => {
		if (err && err.code == 'ENOENT') return sendError(req, res, dir, "404");
		if (err) return sendError(req, res, dir, "401", err);

		if (dir.index) {
			for (index of dir.index) {
				if (files.includes(index)) {
					req.file_path = path.join(req.file_path, index);
					return sendFile(req, res, dir);
				}
			}
		}

		sendDirectoryListing(req, res, dir, files);
	});
};

/***************************************************************************************************************************
 * Send Directory Listing to Client.
***************************************************************************************************************************/
sendDirectoryListing = (req, res, dir, files) => {
	if (!dir.directory_listing) return sendError(req, res, dir, "403", "Listing disabled.");
		
	res.setHeader('Content-type', 'text/html');

	res.writeHead(200);

	res.write(`Directory: ${req.user_path}`);

	for (let file of files) res.write(`<br/><a href="/${path.join(req.user_path, file)}">${file}</a>`);
	
	res.end();

	if (dir.request_logging) console.log("Returned Directory.");
};

/***************************************************************************************************************************
 * Send Result
***************************************************************************************************************************/
sendResult = (req, res, dir) => {
	fs.lstat(req.file_path, (err, stat) => {

		if (err && err.code == 'ENOENT') return sendError(req, res, dir, "404");

		if (err) return sendError(req, res, dir, "401", err);
		
		//console.log(req.file_path, stat.isFile(), stat.isDirectory());

		if (stat.isFile()) return sendFile(req, res, dir);

		if (stat.isDirectory()) return sendDirectory(req, res, dir);

		sendError(req, res, dir, "404", "Location not found.");
	});
};

/***************************************************************************************************************************
 * Get directory from request.
***************************************************************************************************************************/
const getRequestDirectory = (req) => {
	
	let found;
	let path = [ ];
	let location = [ ];
	let directory = directories;
	let parts = req.url.split("/");

	while (true) {
		part = parts.shift();

		if (part == null) {
			break;
		}

		if (part === "") {
			continue;
		}

		path.push(part);

		if (directory.directories && directory.directories[part]) {
			location.push(part);
			directory = directory.directories[part];
			console.log("FOUND!");
			if (directory.path)
				found = {
					location: [...location],
					parts: [...parts],
					directory
				};

			continue;
		}

		break;
	}

	if (found) {
		parts = found.parts;
		location = found.location;
		directory = found.directory;
	}

	if (directory && directory.root) {
		path = [...path, ...parts];
		parts = path;
	}

	return { parts, location, path, directory};
};

/***************************************************************************************************************************
 * Handel Request
***************************************************************************************************************************/
const handelRequest = (req, res) => {

	let {directory, location, parts, path} = getRequestDirectory(req);

	if (!directory || !directory.path) {
		if (config.request_logging) console.log("Uknown Request:", req.url);
		return sendError(req, res, config.request_logging , "404", "No redirection url found.");
	}

	if (directory.request_logging) console.log("Requesting:", req.url);

	req.user_path = [...location, ...parts].join("/");
	req.file_path = [directory.path, ...parts].join("/");
	
	if (directory.request_logging) console.log("Resolved Location:", req.file_path);

	sendResult(req, res, directory);
};

/***************************************************************************************************************************
 * Start Server
***************************************************************************************************************************/

if (config.key && config.cert) {
	try {
		const options = {
			key: fs.readFileSync(config.key),
			cert: fs.readFileSync(config.cert)
		};
		console.log(`Starting HTTPS server on port ${PORT}`);
		https.createServer(options, handelRequest).listen(PORT, () => {
			console.log(`HTTPS server started on port "${PORT}".`);
		});
	} catch (e) {
		console.log('error', e);
		console.log(`Fallback, Starting HTTP server on port ${PORT}`);
		http.createServer(handelRequest).listen(PORT, () => {
			console.log(`HTTP server started on port "${PORT}".`);
		});
	}
} else {
	console.log(`Starting HTTP server on port ${PORT}`);
	http.createServer(handelRequest).listen(PORT, () => {
		console.log(`HTTP server started on port "${PORT}".`);
	});
}


