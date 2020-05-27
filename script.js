"use strict";

const CHATFIELDTYPES = Object.freeze({ "user": 1, "bot": 2 });
const BASE = "/api/messages";
const HUB = "/receiverhub"
const CONVERSATION_ID = "1";

const HARDCODED_CARD = {
    "type": "AdaptiveCard",
    "version": "1.0",
    "body": [
        {
            "type": "Image",
            "url": "http://adaptivecards.io/content/adaptive-card-50.png"
        },
        {
            "type": "TextBlock",
            "text": "Hello **Adaptive Cards!**"
        }
    ],
    "actions": [
        {
            "type": "Action.OpenUrl",
            "title": "Learn more",
            "url": "http://adaptivecards.io"
        },
        {
            "type": "Action.OpenUrl",
            "title": "GitHub",
            "url": "http://github.com/Microsoft/AdaptiveCards"
        }
    ]
};

const connection = new signalR.HubConnectionBuilder()
    .withUrl(HUB)
    .configureLogging(signalR.LogLevel.Information)
    .build();

async function start() {
    try {
        await connection.start();
        console.log("connected");
    } catch (err) {
        console.log(err);
        setTimeout(() => start(), 5000);
    }
};

connection.onclose(async () => {
    await start();
});

connection.on(CONVERSATION_ID, () => {
    alert("ANGEKOMMEN");
    /*const resp = await fetch(newUrl, {
        method: 'POST',
        credentials: 'include',
        mode: 'cors'
    });
    const status = await resp.status;
    const result = await resp.json();
    return [status, result];*/
});

// Start the connection.
start();

function SetUp() {
    document.getElementById("inputForm").addEventListener("submit", SubmitInput);
}

function CreateIcon() {
    let icon = document.createElement("img"); // TODO: Bild und Name etc. per Anfrage an Backend holen...
    icon.src = "ESC.png";
    icon.alt = "ESC-Avatar";
    return icon;
}

function SubmitInput(event) {
    let input = document.getElementById("inputField").value;
    document.getElementById("inputField").value = "";
    let chatField = CreateChatField(input, CHATFIELDTYPES.user);  // FÜR TESTZWECKE KANN HIER BOT STATT USER VERWENDET WERDEN
    document.getElementById("chat-container").appendChild(chatField);
    event.preventDefault();  // to prevent the page to getting redirected after clicking the submit button or pressing 'Enter'
}

function CreateChatField(content, type) {
    let chatFieldClass = "chat-field";
    let chatField = document.createElement("div");
    let renderedContent;
    switch (type) {
        case CHATFIELDTYPES.user:
            chatFieldClass += " darker right";
            renderedContent = CreateText(content);
            break;
        case CHATFIELDTYPES.bot:
            let icon = CreateIcon();
            chatField.appendChild(icon);
            // EXAMPLE:
            renderedContent = CreateAdaptveCard(HARDCODED_CARD);
            break;
        default:
            console.log("An error occured while parsing the CHATFIELDTYPE.");
            return;
    }
    chatField.className = chatFieldClass;
    chatField.appendChild(renderedContent);
    let timeSpan = CreateTimeSpan();
    chatField.appendChild(timeSpan);
    return chatField;
}

function CreateTimeSpan() {
    let timeSpan = document.createElement("span");
    timeSpan.className = "time";
    timeSpan.innerText = ParseTime();
    return timeSpan;
}

function ParseTime() {
    let d = new Date();
    return AddLeadingZero(d.getHours()) + ":" + AddLeadingZero(d.getMinutes()) + ":" + AddLeadingZero(d.getSeconds());
}

function AddLeadingZero(number) {
    return number > 9 ? number : "0" + number;
}

function CreateText(content) {
    let paragraph = document.createElement("p");
    paragraph.className = "txt";
    paragraph.innerText = content;
    return paragraph;
}

function CreateAdaptveCard(content) {
    let adaptiveCard = new AdaptiveCards.AdaptiveCard();
    adaptiveCard.hostConfig = new AdaptiveCards.HostConfig({
        fontFamily: document.body.fontFamily
        // More host config options
    });
    adaptiveCard.onExecuteAction = function (action) {
        let chatField = CreateChatField(action.text, CHATFIELDTYPES.user); // TODO Variable Text prüfen
        document.getElementById("chat-container").appendChild(chatField);
    }
    adaptiveCard.parse(content);
    return adaptiveCard.render();
}