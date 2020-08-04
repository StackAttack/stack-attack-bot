import nock from "nock";
// Requiring our app implementation
import myProbotApp from "../src";
import { Probot } from "probot";
// Requiring our fixtures
import payload from "./fixtures/issues.opened.json";
const issueCreatedBody = { body: "Thanks for opening this issue!" };
import fs from "fs";
import path from "path";

describe("My Probot app", () => {
  let probot: Probot;
  let mockCert: string;

  beforeAll((done) => {
    fs.readFile(path.join(__dirname, "fixtures/mock-cert.pem"), (err, cert) => {
      if (err) return done(err);
      mockCert = cert.toString();
      done();
    });
  });

  beforeEach(() => {
    nock.disableNetConnect();
    probot = new Probot({ id: 123, cert: mockCert });
    // Load our app into probot
    probot.load(myProbotApp);
  });

  // eslint-disable-next-line jest/no-test-callback
  test("creates a comment when an issue is opened", async (done) => {
    // Test that we correctly return a test token
    nock("https://api.github.com")
      .post("/app/installations/2/access_tokens")
      .reply(200, { token: "test" });

    // Test that a comment is posted
    nock("https://api.github.com")
      .post("/repos/hiimbex/testing-things/issues/1/comments", (body) => {
        done(expect(body).toMatchObject(issueCreatedBody));
        return true;
      })
      .reply(200);

    // Receive a webhook event
    await probot.receive({ id: "1234", name: "issues", payload });
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });
});
