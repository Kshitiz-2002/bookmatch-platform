import app from "./app";
import { log } from "./utils/logger";

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, () => {
  log.info(`BookMatch API listening on port ${PORT}`);
});
