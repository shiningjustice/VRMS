const express = require("express");
const router = express.Router();
const fs = require("fs");
const { google } = require("googleapis");
const async = require("async");
// require("dotenv").config();
const fetch = require('node-fetch');

const SCOPES = ["https://www.googleapis.com/auth/drive"];

const githubOrganization = 'testvrms';

// GET /api/grantpermission/googleDrive

router.post("/googleDrive", async (req, res) => {
    // checks if email and file to change are in req.body
    if (!req.body.email || !req.body.file) {
        return res.status(500).send({ message: "Error, no email or file specified!" });
    }

    fs.readFile("credentials.json", async (err, content) => {
        const credentialsObject = JSON.parse(content);
        const { client_secret, client_id, redirect_uris } = credentialsObject.web;
		const oAuth2Client = new google.auth.OAuth2(
			client_id,
			client_secret,
			redirect_uris[1]
		);

		if (err)
			return res.status(500).send({
				message: 'Error loading client secret file:' + err.message,
			});

		const tokenObject = {
			access_token: process.env.GOOGLE_ACCESS_TOKEN,
			refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
			scope: 'https://www.googleapis.com/auth/drive',
			token_type: 'Bearer',
			expiry_date: process.env.GOOGLE_EXPIRY_DATE,
		};
		console.log(tokenObject);
		oAuth2Client.setCredentials(tokenObject);

		// sends google drive grant permission from VRMS to email
		try {
			const result = await grantPermission(
				oAuth2Client,
				req.body.email,
				req.body.file
			);
			if (result.success) {
				const successObject = { message: 'Success!' };
				return res.status(200).send(successObject);
			} else {
				return res.status(500).send({ message: result.message });
			}
		} catch (err) {
			return res.status(500).send({ message: err.message });
		}
	});
});

// GET /api/grantpermission/gitHub (checks if it can update the db data)

router.post('/gitHub', async (req, res) => {
	// call API to add user to repo
	const userHandle = req.body.handle;
    const { repoName } = req.body;

	try {
		// User is in organization?
		const userStatus = await checkMembershipStatus(userHandle);
		const membershipStatus = userStatus
			? userStatus
			: (await inviteToOrg(userHandle)) && 'pending';

		// User is a collaborator on repository?
		const collaboratorStatus = await addAsCollaborator(userHandle, repoName);

		const result = {
			membershipStatus,
			collaboratorStatus,
		};

		if (membershipStatus === 'active') {
			// check if membership is public
			result.publicMembership = await checkPublicMembership(userHandle);

			// check if 2FA is enabled
			result.twoFAenabled = await check2FA(userHandle);
		}

		return res.status(200).send(result);
	} catch (err) {
		return res.status(500).send({ message: err.message });
	}
});

router.post('/', async (req, res) => {
	fs.readFile('credentials.json', async (err, content) => {
		const credentialsObject = JSON.parse(content);
		const { client_secret, client_id, redirect_uris } = credentialsObject.web;
		const oAuth2Client = new google.auth.OAuth2(
			client_id,
			client_secret,
			redirect_uris[1]
		);

        // sends back error if credentials files cannot be read
        if (err)
            return res.status(500).send({
                message: "Error loading client secret file:" + err.message,
            });

        let token;
        let setToken = false;

        // if the user did not send a refresh/access token with them in the body request
        if (!req.body.token && req.body.code) {
            try {
                const tokenResult = await sendToken(oAuth2Client, req.body.code);
                if (!tokenResult.success) {
                    return res.status(500).send({ message: tokenResult.message });
                } else {
                    console.log(tokenResult);
                    token = tokenResult.token;
                    setToken = true;
                }
            } catch (err) {
                console.log("THIS ERROR", err);
                return res.status(500).send({ message: err.message });
            }
            // if token is already placed into body request
        } else if (req.body.token) {
            token = req.body.token;
        }
        if (token) {
            oAuth2Client.setCredentials(token);
            try {
                // another callback function that returns promises can replace this method
                console.log("TRY");
                const result = await grantPermission(oAuth2Client, req.body.email, req.body.file);
                if (result.success) {
                    {
                        const successObject = { message: "Success!" };
                        if (setToken) {
                            successObject.token = token;
                        }
                        return res.status(200).send(successObject);
                    }
                } else {
                    return res.status(500).send({ message: result.message });
                }
            } catch (err) {
                console.log(err.message);
                return res.status(500).send({ message: err.message });
            }
        } else {
            // returns a URL for the user to give permission
            return res.status(200).send({ url: sendURL(oAuth2Client) });
        }
    });
});

// If modifying these scopes, delete token.json.

/**
 * Creates an auth URL that lets the user give permission to VRMS.
 * @param {oAuth2Client} oAuth2Client The OAuth2 client needed to generate an auth url.
 */
function sendURL(oAuth2Client) {
	const authUrl = oAuth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: SCOPES,
	});
	return authUrl;
}

/**
 * Creates an token object including access token and refresh token that will allow the user to
 * be able to log in without needed to give permission each time
 * @param {oAuth2Client} oAuth2Client The authorization OAuth2 client needed to create a token object.
 * @param {String} code The code string from the auth URL.
 */
function sendToken(oAuth2Client, code) {
	return new Promise(function (resolve, reject) {
		oAuth2Client.getToken(code, (err, token) => {
			if (err)
				reject({
					success: false,
					message: 'Error retrieving access token' + err.message,
				});
			resolve({ success: true, token });
		});
	});
}

/**
 * Lists the names and IDs of up to 10 files.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @returns {Promise} Promise with an object that contains the boolean success to determine
 * what to do in the route. Rejection objects also have a message field.
 */
function listFiles(auth) {
	const drive = google.drive({ version: 'v3', auth });
	return new Promise(function (resolve, reject) {
		drive.files.list(
			{
				pageSize: 10,
				fields: 'nextPageToken, files(id, name)',
			},
			(err, res) => {
				if (err)
					reject({
						success: false,
						message: 'The API returned an error: ' + err.message,
					});
				const files = res.data.files;
				if (files.length) {
					console.log('Files:');
					files.map((file) => {
						console.log(`${file.name} (${file.id})`);
					});
					resolve({ success: true });
				} else {
					return reject({
						success: false,
						message: 'No files found',
					});
				}
			}
		);
	});
}

/**
 * Gives Google Drive permission to an email address for the file ID
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @param {String} email E-mail to receive Google Drive invite
 * @param {String} fileId File ID to give permissions
 * @returns {Promise} Promise with an object that contains the boolean success to determine
 * what to do in the route. Rejection objects also have a message field.
 */
function grantPermission(auth, email, fileId) {
	console.log('GRANT PERMISSIONS');
	var permissions = [
		{
			type: 'user',
			role: 'writer',
			emailAddress: email,
		},
	];

	return new Promise(function (resolve, reject) {
		async.eachSeries(permissions, function (permission, permissionCallback) {
			const drive = google.drive({ version: 'v3', auth });
			drive.permissions.create(
				{
					resource: permission,
					fileId: fileId,
					fields: 'id',
					emailMessage:
						'Hi there! You are receiving this message from the VRMS team. Enjoy!',
				},
				(err, res) => {
					if (err) {
						console.log('PROMISE ERROR', err);
						reject({
							success: false,
							message: 'The API returned an error: ' + err.message,
						});
					} else {
						console.log('RES', res);
						permissionCallback();
						resolve({ success: true });
					}
				}
			);
		});
	});
}

/**
 * Checks if user is a public OR private member of the organization.
 * Requires authentication to the organization (currently via a token in env file).
 * @param {str} githubHandle
 */
function checkMembershipStatus(githubHandle) {
	return fetch(
		`https://api.github.com/orgs/${githubOrganization}/memberships/${githubHandle}`,
		{
			method: 'GET',
			headers: {
				Authorization: `token ${process.env.GITHUB_TOKEN}`,
			},
		}
	)
		.then((res) => {
			if (res.status === 200) return res.json();
			if (res.status === 404) return false;

			return new Error('Unexpected result');
		})
		.then((res) => {
			if (res) {
				return res.state === 'pending' ? 'pending' : 'active';
			} else {
				return false;
			}
		});
}

/**
 * API call returns 200 if successfully invited or if already in organization
 * @param {str} githubHandle
 */
function inviteToOrg(githubHandle) {
	return fetch(
		`https://api.github.com/orgs/${githubOrganization}/memberships/${githubHandle}?role=member`,
		{
			method: 'PUT',
			headers: {
				Authorization: `token ${process.env.GITHUB_TOKEN}`,
			},
		}
	)
		.then((res) =>
			res.status === 200 ? true : new Error('Unexpected response')
		)
		.catch((err) => console.log('The API returned an error: ' + err.message));
}

// function checkUserCollaborationStatus(githubHandle, repoName) {
// 	return fetch(
// 		`https://api.github.com/repos/${githubOrganization}/${repoName}/collaborators/${githubHandle}`, {
//             headers: {
// 				Authorization: `token ${process.env.GITHUB_TOKEN}`,
// 			},
//         }
// 	)
// 		.then((res) => {
// 			if (res.status === '204') return true;
// 			if (res.status === '404') return false;
// 			return new Error('Unexpected response');
// 		})
// 		.catch((err) => console.log('The API returned an error: ' + err.message));
// }

/**
 * @returns "active" or "pending". Returns "active" if already a collaborator OR
 * if already a member of the organization (automatically adds them). Returns
 * "pending" if membership is pending (collaborator invite is sent).
 * @param {str} githubHandle
 * @param {str} repoName
 */
function addAsCollaborator(githubHandle, repoName) {
	return fetch(
		`https://api.github.com/repos/${githubOrganization}/${repoName}/collaborators/${githubHandle}?permission=push`,
		{
			method: 'PUT',
			headers: {
				Authorization: `token ${process.env.GITHUB_TOKEN}`,
			},
		}
	)
		.then((res) => {
			if (res.status === 204) return 'active';
			if (res.status === 201) return 'pending';
		})
		.catch((err) => console.log('The API returned an error: ' + err.message));
}

function check2FA(githubHandle) {
	return fetch(
		`https://api.github.com/orgs/${githubOrganization}/members?filter=2fa_disabled`
	)
		.then((no2FAMembersArr) => {
			if (no2FAMembersArr.length) {
				return !no2FAMembersArr.includes(
					(member) => member.login === githubHandle
				);
			}

			return true;
		})
		.catch((err) => console.log('The API returned an error: ' + err.message));
}

function checkPublicMembership(githubHandle) {
	return fetch(
		`https://api.github.com/orgs/${githubOrganization}/public_members/${githubHandle}`
	)
		.then((res) => (res.status === 204 ? true : false))
		.catch((err) => console.log('The API returned an error: ' + err.message));
}

module.exports = router;
