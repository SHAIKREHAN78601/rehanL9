/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
const request = require("supertest");
var cheerio = require("cheerio");

const db = require("../models/index");
const app = require("../app");

let server, agent;
function extractCsrfToken(res) {
  var $ = cheerio.load(res.text);
  return $("[name=_csrf]").val();
}

const login = async (agent, username, password) => {
  let res = await agent.get("/login");
  let csrfToken = extractCsrfToken(res);
  res = await agent.post("/session").send({
    email: username,
    password: password,
    _csrf: csrfToken,
  });
};

describe("Todo test suite", () => {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    server = app.listen(4000, () => {});
    agent = request.agent(server);
  });
  afterAll(async () => {
    try {
      await db.sequelize.close();
      server.close();
    } catch (error) {
      console.log(error);
    }
  });

  test("Sign up", async () => {
    let res = await agent.get("/signup");
    const csrfToken = extractCsrfToken(res);
    res = await agent.post("/users").send({
      firstName: "Test",
      lastName: "First User",
      email: "user@gmail.com",
      password: "123456789",
      _csrf: csrfToken,
    });
    expect(res.statusCode).toBe(302);
  });

  test("Sign Out", async () => {
    let res = await agent.get("/todos");
    expect(res.statusCode).toBe(200);
    res = await agent.get("/signout");
    expect(res.statusCode).toBe(302);
    res = await agent.get("/todos");
    expect(res.statusCode).toBe(302);
  });

  test("Creates a todo", async () => {
    const agent = request.agent(server);
    await login(agent, "user@gmail.com", "123456789");
    const res = await agent.get("/todos");
    const csrfToken = extractCsrfToken(res);
    const response = await agent.post("/todos").send({
      title: "Buy 1L of milk",
      dueDate: new Date().toISOString(),
      _csrf: csrfToken,
    });
    expect(response.statusCode).toBe(302);
  });

  test("Update a todo with requested ID as complete / incomplete", async () => {
    const agent = request.agent(server);
    await login(agent, "user@gmail.com", "123456789");
    let res = await agent.get("/todos");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/todos").send({
      title: "Buy 1L of milk",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });
    await agent.post("/todos").send({
      title: "Buy Meat for Uncle",
      dueDate: new Date().toISOString(),
      _csrf: csrfToken,
    });

    const groupedTodosResponse = await agent
      .get("/todos")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedTodosResponse.text);
    const dueTodayCount = parsedGroupedResponse.duetodaytodos.length;
    const latestTodo = parsedGroupedResponse.duetodaytodos[dueTodayCount - 1];
    let completedstatus = true;
    res = await agent.get("/todos");
    csrfToken = extractCsrfToken(res);
    var response = await agent.put(`/todos/${latestTodo.id}`).send({
      _csrf: csrfToken,
      completed: completedstatus,
    });
    console.log(response.text);
    var newparsedUpdateResponse = JSON.parse(response.text);
    expect(newparsedUpdateResponse.completed).toBe(true);
    completedstatus = false;
    res = await agent.get("/todos");
    csrfToken = extractCsrfToken(res);
    var response1 = await agent.put(`/todos/${latestTodo.id}`).send({
      _csrf: csrfToken,
      completed: completedstatus,
    });
    console.log(response.text);
    var newparsedUpdateResponse1 = JSON.parse(response1.text);
    expect(newparsedUpdateResponse1.completed).toBe(false);
  });

  test("userA cannot update userB's todo", async () => {
    const agent = request.agent(server);

    let x1 = await agent.get("/signup");
    let csrfToken = extractCsrfToken(x1);

    await agent.post("/users").send({
      firstName: "Test",
      lastName: "a",
      email: "testa@gmail.com",
      password: "123456789",
      _csrf: csrfToken,
    });

    let res = await agent.get("/todos");
    csrfToken = extractCsrfToken(res);

    await agent.post("/todos").send({
      title: "Purchace bag for Mummy",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });

    const groupedTodosResponse = await agent
      .get("/todos")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedTodosResponse.text);
    const dueTodayCount = parsedGroupedResponse.duetodaytodos.length;
    const latestTodo = parsedGroupedResponse.duetodaytodos[dueTodayCount - 1];

    await agent.get("/signout");

    let x3 = await agent.get("/signup");
    csrfToken = extractCsrfToken(x3);

    await agent.post("/users").send({
      firstName: "Test",
      lastName: "b",
      email: "testb@gmail.com",
      password: "123456789",
      _csrf: csrfToken,
    });

    res = await agent.get("/todos");
    csrfToken = extractCsrfToken(res);

    const markCompleteResponse = await agent
      .put(`/todos/${latestTodo.id}`)
      .send({
        _csrf: csrfToken,
      });

    const parsedUpdateResponse = JSON.parse(markCompleteResponse.text);
    expect(parsedUpdateResponse.completed).toBe(false);
  });

  test("userA cannot delete userB's todo", async () => {
    const agent = request.agent(server);
    await login(agent, "testa@gmail.com", "123456789");

    const groupedTodosResponse = await agent
      .get("/todos")
      .set("Accept", "application/json");

    const parsedGroupedResponse = JSON.parse(groupedTodosResponse.text);
    const dueTodayCount = parsedGroupedResponse.duetodaytodos.length;
    const latestTodo = parsedGroupedResponse.duetodaytodos[dueTodayCount - 1];

    await agent.get("/signout");

    await login(agent, "testb@gmail.com", "123456789");

    res = await agent.get("/todos");
    csrfToken = extractCsrfToken(res);

    const deleteResponse = await agent.delete(`/todos/${latestTodo.id}`).send({
      _csrf: csrfToken,
    });

    const deletestatus = JSON.parse(deleteResponse.text);
    expect(deletestatus).toBe(false);
  });

  test("Deletes a todo with the given ID if it exists and sends a boolean response", async () => {
    // FILL IN YOUR CODE HERE
    const agent = request.agent(server);
    await login(agent, "user@gmail.com", "123456789");
    let res = await agent.get("/todos");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/todos").send({
      title: "Buy packet of Laddoo",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });
    await agent.post("/todos").send({
      title: "Buy Meat",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });
    await agent.post("/todos").send({
      title: "Buy 1L of milk",
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    });

    const groupedTodosResponse = await agent
      .get("/todos")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedTodosResponse.text);
    const dueTodayCount = parsedGroupedResponse.duetodaytodos.length;
    const latestTodo = parsedGroupedResponse.duetodaytodos[dueTodayCount - 1];

    res = await agent.get("/todos");
    csrfToken = extractCsrfToken(res);
    const deleteResponse = await agent.delete(`/todos/${latestTodo.id}`).send({
      _csrf: csrfToken,
    });

    const deletestatus = JSON.parse(deleteResponse.text);
    console.log("delete test");
    console.log(deletestatus);

    deletestatus
      ? expect(deletestatus).toBe(true)
      : expect(deletestatus).toBe(false);
  });
});
