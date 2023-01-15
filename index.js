const app = require("./app");
const port = typeof process.env.PORT === "undefined" ? 3000 : process.env.PORT;

app.listen(port, () => {
  console.log("Started express server at port " + port);
});