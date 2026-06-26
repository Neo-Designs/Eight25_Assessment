import asyncio
import sys
import uvicorn
import os

def main():
    # Force the correct loop policy on Windows for Playwright/Subprocesses
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    
    # Run Uvicorn directly
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False)

if __name__ == "__main__":
    main()