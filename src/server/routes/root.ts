import express from "express";

const router = express.Router();

router.get("/", (request, response) => {
  const title = "Gator Tot's Game of Bullshit";
  const warning = request.query.warning;

  response.render("root", { title, warning });
});

export default router;
