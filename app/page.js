"use client";

import { Box, Button, Stack, TextField, Typography, useTheme } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import ChatIcon from "@mui/icons-material/Chat";
import { useState } from "react";

export default function Home() {
  const theme = useTheme();

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm the Rate My Professor support assistant. How can I help you today?"
    }
  ])

  const [message, setMessage] = useState('')
  const sendMessage = async () => {
    setMessages((messages)=> [
      ...messages,
      {role: "user", content: message},
      {role: "assistant", content: ''}
    ])

    setMessage('')
    const response = fetch('/api/chat', {
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([...messages, {role: "user", content: message}])
    }).then(async (res) => {
      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      let result = ''
      return reader.read().then(function processText({done, value}) {
        if (done) {
          return result
        }
        const text = decoder.decode(value || new Uint8Array(), {stream: true})
        setMessages((messages) => {
          let lastMessage = messages[messages.length - 1]
          let otherMessages = messages.slice(0, messages.length - 1)
          return [
            ...otherMessages,
            {...lastMessage, content: lastMessage.content + text},
          ]
        })

        return reader.read().then(processText)
      })
    })

  }

  return (
    <Box
      width="100vw"
      height="100vh"
      display="flex"
      justifyContent="center"
      alignItems="center"
      bgcolor={theme.palette.background.default}
      p={3}
      sx={{
        backgroundImage: 'url("/images/bg.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        position: 'absolute',
      }}
    >
      <Stack
        direction="row"
        width="100%"
        maxWidth="1200px"
        height="80vh"
        boxShadow={3}
        bgcolor="rgba(255, 255, 255, 0.7)"
        borderRadius={5}
        position="relative"
      >
        <Box
          flex={2}
          p={4}
          display="flex"
          flexDirection="column"
          justifyContent="center"
          bgcolor={theme.palette.grey[100]}
          borderRadius="16px 0 0 16px"
          alignItems="center"
          sx={{
            backgroundImage: 'url("/images/professor.png")',
            backgroundSize: "cover",
            backgroundPosition: "center",
            color: "white",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Box 
            component="div"
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'rgba(0, 0, 0, 0.8)',
              zIndex: 1,
            }}
          />
          <Box
            p={4}
            sx={{
              position: 'absolute',
              zIndex: 2,
              color: 'white',
              textAlign: 'center'
            }}
          >
            <Typography sx={{ fontFamily: 'Poppins', color: 'orange' }} variant="h4" align="center" gutterBottom>
              Rate My Professor
            </Typography>
            <p color="textSecondary" align="center">
              Meet our Rate My Professor AI Assistant - your personalized guide to finding the best professors. This AI-driven tool helps you navigate through ratings and reviews, making it easier to choose the right professor for your courses.
            </p>
            <Typography sx={{ fontFamily: 'Poppins', mb: 2, color: 'orange' }} variant="body1" align="center" mt={2}>
            Get insights into professor ratings, read detailed reviews, and make informed decisions for your academic journey with the help of our intelligent assistant.
            </Typography>
          </Box>
        </Box>
        <Box
          flex={2}
          p={4}
          display="flex"
          flexDirection="column"
          justifyContent="space-between"
          borderRadius="0 16px 16px 0"
          sx={{
            bgcolor: "rgba(255, 255, 255, 0.1)",
            backdropFilter: "blur(1px)"
          }}
        >
          <Stack
            direction="column"
            spacing={2}
            flexGrow={3}
            overflow='auto'
            maxHeight='100%'
            sx={{
              "::-webkit-scrollbar": {
                width: "6px",
              },
              "::-webkit-scrollbar-thumb": {
                backgroundColor: theme.palette.primary.main,
                borderRadius: "3px",
              }
            }}
          >
            {messages.map((message, index) => (
              <Box
                key={index}
                display="flex"
                alignItems="center"
                justifyContent={
                  message.role === "assistant"? "flex-start" : "flex-end"
                }
              >
                {message.role === "assistant" && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      marginRight: 1,
                      fontSize: 30,
                    }}
                  >
                    &#129302;
                  </Box>
                )}
                <Box
                  bgcolor={
                    message.role === "assistant" ? "rgba(0, 123, 255, 0.7)" : "rgba(255, 193, 7, 0.7)"
                  }
                  color="white"
                  borderRadius={10}
                  p={2}
                  boxShadow={1}
                  maxWidth="80%"
                  sx={{ wordWrap: "break-word", display: 'flex', alignItems: 'center' }}
                >
                  {message.content}
                </Box>
                {message.role === "user" && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      marginLeft: 1,
                      fontSize: 30,
                    }}
                  >
                    &#128100;
                  </Box>
                )}
              </Box>
            ))}
          </Stack>
          <Stack
            direction="row"
            spacing={2}
            mt={2}
          >
            <TextField 
              label="Type a message..."
              fullWidth
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              variant="outlined"
              InputProps={{
                style: {
                  borderRadius: 50,
                  backgroundColor: "rgba(255, 255, 255, 0.8"
                },
              }}
            />
            <Button 
              variant="contained" 
              onClick={sendMessage}
              sx={{
                borderRadius: "50px",
                padding: "10px 20px",
                minWidth: "50px"
              }}
            >
              <SendIcon />
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
