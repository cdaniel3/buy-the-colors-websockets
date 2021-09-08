# Buy the Colors (websocket server)

This server communicates with a browser-based board game application when:
* A player is "registering" by providing their player name and waiting on other players
* At the end of every player turn, the game state is sent from the browser-based application to this server, and then this server broadcasts that (updated) game state to all players
* Maintaining a list of active and inactive players
* Reconnecting inactive players

The internal game state is managed by elm and the corresponding project is https://github.com/cdaniel3/BuyTheColors

When I wrote this, I understood there would be security implications (the entire game state, including all players' hidden cards) is stored in the javascript object, so technically it wouldn't be hard to cheat at this game). But I figured this was about the same as "cheating" using tabletop simulator. In other words, I'm not planning on playing with someone who I don't know personally.