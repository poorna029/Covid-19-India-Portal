const express = require("express");
const app = express();
app.use(express.json());
module.exports = app;
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbpath = path.join(__dirname, "covid19IndiaPortal.db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
let db = null;

const initializeDBandServer = async () => {
  try {
    app.listen(3000, () => {
      console.log("server is running at http://localhost:3000");
    });
    db = await open({ filename: dbpath, driver: sqlite3.Database });
  } catch (e) {
    console.log(`DBerror ${e.Message}`);
    process.exit(1);
  }
};
initializeDBandServer();

// /login/ api--> 1

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserInfoQuery = `SELECT * FROM user WHERE username="${username}";`;
  const User = await db.get(getUserInfoQuery);

  if (User === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const is_correct_pw = await bcrypt.compare(password, User.password);
    if (is_correct_pw === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "lkjhgfdsa");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// Authentication middleware api
const authenticationFn = async (request, response, next) => {
  const auth_code = request.headers["authorization"];
  let jwtToken;
  if (auth_code !== undefined) {
    jwtToken = auth_code.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "lkjhgfdsa", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        console.log("Authentication successfull");

        next();
      }
    });
  }
};

// api for state info,( state_id,state_name,population)

app.get("/states/", authenticationFn, async (request, response) => {
  const states_info_Qry = `select state_id as stateId,state_name as stateName,
    population from state;`;
  const states_list = await db.all(states_info_Qry);
  response.send(states_list);
});

// api for state_info based on state_id
app.get("/states/:stateId", authenticationFn, async (request, response) => {
  const { stateId } = request.params;
  const states_info_Qry = `select state_id as stateId,state_name as stateName,
    population from state where stateId="${stateId}";`;
  const states_list = await db.all(states_info_Qry);
  response.send(states_list[0]);
});

// api for posting data in district table

app.post("/districts/", authenticationFn, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const new_dist_insert_Qry = `INSERT INTO 
    district(district_name,state_id,cases,
        cured,active,deaths) values("${districtName}",
        ${stateId},${cases},
        ${cured},${active},${deaths});`;
  await db.run(new_dist_insert_Qry);
  response.send("District Successfully Added");
});

// api for dist_info based on dist_id
app.get(
  "/districts/:districtId",
  authenticationFn,
  async (request, response) => {
    const { districtId } = request.params;
    const dist_info_Qry = `select district_id as districtId,
  district_name as districtName,state_id
  as stateId,cases,
        cured,active,deaths from district where district_id="${districtId}";`;
    const dists_list = await db.all(dist_info_Qry);
    response.send(dists_list[0]);
  }
);

// api for del_dist based on dist_id

app.delete(
  "/districts/:districtId",
  authenticationFn,
  async (request, response) => {
    const { districtId } = request.params;
    const del_dist_qry = `delete from district where district_id=${districtId};`;
    await db.run(del_dist_qry);
    response.send("District Removed");
  }
);

// updating dist_details based on dist_id

app.put(
  "/districts/:districtId",
  authenticationFn,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const dist_upd_qry = `update  district set district_name="${districtName}",
    state_id=${stateId},cases=${cases},cured=${cured},active=${active},deaths=
    ${deaths} where district_id=${districtId};`;
    await db.run(dist_upd_qry);
    response.send("District Details Updated");
  }
);

// api for stats based st_Id

app.get(
  "/states/:stateId/stats/",
  authenticationFn,
  async (request, response) => {
    const { stateId } = request.params;
    const stats_qry = `select sum(cases) as totalCases,
     sum(cured) as totalCured, sum(active) as totalActive ,
     sum(deaths) as totalDeaths from district where state_id="${stateId}";`;
    const state_stats = await db.get(stats_qry);
    response.send(state_stats);
  }
);
