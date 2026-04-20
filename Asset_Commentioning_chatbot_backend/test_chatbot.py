#!/usr/bin/env python3
"""
test_chatbot.py — Script to test all chatbot intents and SQL queries.
Run this on your VM: `python test_chatbot.py`
"""

import requests
import json
import time

# Update this if your backend runs on a different port
URL = "http://localhost:9005/chat"

# The 12 test questions covering every intent we built
TEST_CASES = [
    # 1. Total Target (Overall/Solar/Wind)
    {"q": "What is the overall target for FY 25-26?", "intent": "total_target"},
    {"q": "What is the solar energy full year target for FY 25-26?", "intent": "solar_target"},
    {"q": "What is the total wind target for FY 26-27?", "intent": "wind_target"},

    # 2. Cumulative Actual (The bug we just fixed)
    {"q": "What is the cumulative actual of solar energy as of jan?", "intent": "cumulative_actual"},
    {"q": "Solar energy cumaltive actual status of jan?", "intent": "cumulative_actual"},

    # 3. Plan vs Actual Variance
    {"q": "What is the solar plan vs actual variance for FY 25-26?", "intent": "plan_vs_actual"},

    # 4. Quarterly Breakdown
    {"q": "What is the Q2 target for solar?", "intent": "quarterly"},
    {"q": "Give me the quarterly breakdown for wind energy.", "intent": "quarterly"},

    # 5. Location / Category Target
    {"q": "What is the Khavda solar target for FY 25-26?", "intent": "location_target"},
    {"q": "What is the Rajasthan target?", "intent": "location_target"},

    # 6. Section Targets
    {"q": "What is the Section A capacity?", "intent": "section_target"},
    {"q": "Give me the target capacity by section.", "intent": "section_breakdown"},

    # 7. Category Breakdown
    {"q": "What is the category wise breakdown for solar?", "intent": "category_breakdown"},

    # 8. Project Listing & Detail
    {"q": "List all solar projects.", "intent": "project_list"},
    {"q": "What is the capacity of Khavda Solar Ph-1?", "intent": "project_detail"},
]

print("======================================================")
print("🤖 AGEL CEO Tracker Chatbot - Test Suite")
print(f"Target URL: {URL}")
print("======================================================\n")

for i, tc in enumerate(TEST_CASES, 1):
    question = tc["q"]
    expected_intent = tc["intent"]
    
    print(f"Test {i}/{len(TEST_CASES)}: {expected_intent}")
    print(f"❓ Q: {question}")
    
    try:
        start_time = time.time()
        response = requests.post(
            URL, 
            json={"query": question},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            answer = data.get("answer", "")
            # Print the first 200 chars to keep the log readable
            print(f"✅ A: {answer[:300]}{'...' if len(answer) > 300 else ''}")
            print(f"⏱️  Time: {elapsed:.2f}s")
        else:
            print(f"❌ ERROR: HTTP {response.status_code}")
            print(response.text)
            
    except requests.exceptions.ConnectionError:
        print("❌ ERROR: Connection Refused. Is the backend running on port 9005?")
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        
    print("-" * 50)

print("\n🎉 Test suite complete! Please copy these results and paste them to the AI.")
