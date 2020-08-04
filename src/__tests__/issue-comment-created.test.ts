import type { ResponseResolver } from "msw/lib/types";

import fs from "fs";
import path from "path";
import { Probot } from "probot";

import { server, rest } from "../../test/server";
import { mockLogger } from "../logger/mockLogger";
import { event } from "../handlers/issue-comment-created";
import { makeAppFunction } from "../makeAppFunction";

const owner = "sttack";
const repo = "watermelons";
const issueNumber = 16;

function makePullRequestCommentPayload(comment: string, description: string) {
  return {
    id: "1234",
    name: "issue_comment",
    payload: {
      action: "created",
      issue: {
        id: 670684161,
        number: 16,
        title: "Someone else comes along",
        user: {
          login: "24r",
        },
        state: "open",
        pull_request: {},
        body: description,
        performed_via_github_app: null,
      },
      comment: {
        user: {
          login: "24r",
        },
        author_association: "OWNER", // TODO: Check what this is
        body: comment,
      },
      repository: {
        name: repo,
        owner: {
          login: owner,
        },
      },
    },
  };
}

function makeIssueCommentPayload(comment: string) {
  const prPayload = makePullRequestCommentPayload(
    comment,
    "Nolite te bastardes carborundorum."
  );
  delete prPayload.payload.issue.pull_request;
  return prPayload;
}

describe(event, () => {
  let probot: Probot;
  let mockCert: string;

  beforeAll((done) => {
    fs.readFile(
      path.join(__dirname, "../../test/fixtures/mock-cert.pem"),
      (err, cert) => {
        if (err) return done.fail(err);
        mockCert = cert.toString();
        done();
      }
    );
  });

  beforeEach(() => {
    probot = new Probot({ id: 123, cert: mockCert });
    probot.load(makeAppFunction(mockLogger()));
  });

  it("should ignore comments on issues", async () => {
    const mockCommentPostHandler = jest.fn();
    server.use(
      rest.post(
        `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
        mockCommentPostHandler
      )
    );
    await probot.receive(makeIssueCommentPayload("@sttack rebase"));
    expect(mockCommentPostHandler).not.toHaveBeenCalled();
  });

  it("should ignore comments not addressed to us", async () => {
    const mockCommentPostHandler = jest.fn();
    server.use(
      rest.post(
        `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
        mockCommentPostHandler
      )
    );
    await probot.receive(makePullRequestCommentPayload("hello", ""));
    expect(mockCommentPostHandler).not.toHaveBeenCalled();
  });

  it("should send help for comments addressed to us that do not have a valid command", async () => {
    const mockCommentPostHandler: ResponseResolver = jest.fn((req, res) => {
      expect(req.body).toMatchInlineSnapshot(`
        Object {
          "body": "HEY! Thanks for pinging [Stack Attack](https://github.com/taneliang/stack-attack).

        Here's how you can use me:

        * Ask me to land a stack of Stack Attack PRs: \`@sttack land\`
        * Ask me to rebase a stack of Stack Attack PRs: \`@sttack rebase\`

        🥞
        ",
        }
      `);
      return res();
    });
    server.use(
      rest.post(
        `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
        mockCommentPostHandler
      )
    );
    await probot.receive(makePullRequestCommentPayload("@sttack hello", ""));
    expect(mockCommentPostHandler).toHaveBeenCalled();
  });

  it("should handle land commands addressed to us", async () => {
    const mockCommentPostHandler: ResponseResolver = jest.fn((req, res) => {
      expect(req.body).toMatchInlineSnapshot(`
        Object {
          "body": "Landing!",
        }
      `);
      return res();
    });
    server.use(
      rest.post(
        `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
        mockCommentPostHandler
      )
    );
    await probot.receive(makePullRequestCommentPayload("@sttack land", ""));
    expect(mockCommentPostHandler).toHaveBeenCalled();
  });

  it("should handle rebase commands addressed to us", async () => {
    const mockCommentPostHandler: ResponseResolver = jest.fn((req, res) => {
      expect(req.body).toMatchInlineSnapshot(`
        Object {
          "body": "Rebase!",
        }
      `);
      return res();
    });
    server.use(
      rest.post(
        `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
        mockCommentPostHandler
      )
    );
    await probot.receive(makePullRequestCommentPayload("@sttack rebase", ""));
    expect(mockCommentPostHandler).toHaveBeenCalled();
  });
});
