import httpx
import json
import time
import os
from datetime import datetime
# CRITICAL FIX: Disable SSL verification for Azure/Corporate VM
os.environ["HF_HUB_DISABLE_SSL_VERIFY"] = "1"
os.environ["CURL_CA_BUNDLE"] = ""
os.environ["SSL_CERT_FILE"] = ""
# API Configuration
API_URL = "http://localhost:9005/chat"
OUTPUT_FILE = "data/accuracy_test_results.txt"
# 50 Testing Questions across 4 Layers
QUESTIONS = [
    # --- Category 1: Overall Targets & Aggregates (10) ---
    "What is the total target capacity for the current fiscal year?",
    # "Show me the overall target breakdown for FY 25-26.",
    # "What is the total capacity across all renewable projects?",
    # "Summarize the commissioning targets for the entire year.",
    # "What is the total MW target expected by end of Mar FY 26?",
    # "How much total capacity is planned for section A projects?",
    # "Give me the grand total of the commissioning plan for this FY.",
    # "What is the aggregate target for all SPVs combined?",
    # "Which fiscal year are we currently tracking the most data for?",
    # "What is the total target capacity excluding deleted projects?",
    # # --- Category 2: Solar vs Wind Comparison (10) ---
    # "What is the total capacity of all Solar projects combined?",
    # "What is the total capacity of all Wind projects combined?",
    # "Which category has a higher target: Solar or Wind?",
    # "What percentage of the total target comes from Solar?",
    # "What is the MW difference between Solar and Wind targets?",
    # "List the total planned capacity for Khavda Solar.",
    # "List the total planned capacity for Khavda Wind.",
    # "Compare the Q1 targets for Solar and Wind.",
    # "Which solar project has the highest capacity?",
    # "How many Solar projects are included in the section A totals?",
    # # --- Category 3: Project Level Details (10) ---
    # "What is the capacity of the SECI H-3 project?",
    # "Show me details for the MLP AP New project.",
    # "Which SPV is responsible for the SECI H-3 project?",
    # "What is the planned capacity for Khavda Solar Phase 1 projects?",
    # "Is the SECI H-3 project included in the Total Target?",
    # "What is the project type for MLP AP New?",
    # "Find the capacity for any project under the 'Khavda' SPV.",
    # "Which projects are listed under Section A for FY 25-26?",
    # "What is the capacity of the largest wind project in the database?",
    # "Show me all projects with a capacity greater than 500 MW.",
    # # --- Category 4: Location & Regional Intelligence (10) ---
    # "What is the total target capacity for Rajasthan?",
    # "How many projects are located in Khavda?",
    # "What is the regional total for Mundra Wind projects?",
    # "Show me a location-wise breakdown of commissioning targets.",
    # "Is there any data for Gujarat locations other than Khavda?",
    # "What is the total capacity of Rajasthan Solar projects?",
    # "Which location has the most projects listed?",
    # "Compare the total capacity of Khavda vs Rajasthan.",
    # "Are there any projects located in Madhya Pradesh?",
    # "What is the SPV for Rajasthan-based projects?",
    # # --- Category 5: Logic, Stats & Business Trends (10) ---
    # "What is the standard deviation of project capacities in FY 25-26?",
    # "Explain how the Total Overall Target Capacity is calculated.",
    # "What is the average project capacity for Section A?",
    # "How are 'Actual' vs 'Plan' commissioning values tracked?",
    # "What does 'section A' signify in the database?",
    # "Explain the logic of 'included_in_total' flag.",
    # "What is the monthly trend for commissioning from April to March?",
    # "Which month has the highest planned commissioning target?",
    # "What is the variance between Q1 and Q2 targets?",
    # "Why are some projects excluded from the CEO-level total target?"
]
def run_tests():
    print(f"🚀 Starting RAG Accuracy Test ({len(QUESTIONS)} questions)...")
    results = []
    
    with httpx.Client(timeout=60.0, verify=False) as client:
        for i, query in enumerate(QUESTIONS):
            print(f"[{i+1}/{len(QUESTIONS)}] Querying: {query}")
            start_time = time.time()
            try:
                response = client.post(API_URL, json={"query": query})
                elapsed = time.time() - start_time
                
                if response.status_code == 200:
                    answer = response.json().get("answer", "No answer field in response")
                else:
                    answer = f"Error: Status Code {response.status_code} - {response.text}"
            except Exception as e:
                elapsed = time.time() - start_time
                answer = f"Request Failed: {str(e)}"
            
            results.append({
                "id": i + 1,
                "question": query,
                "answer": answer,
                "latency_sec": round(elapsed, 2)
            })
            
            # Brief pause to avoid overloading if local
            time.sleep(0.5)
    # Generate Markdown Report
    print(f"📝 Generating Report: {OUTPUT_FILE}")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("# RAG Accuracy Verification Report\n\n")
        f.write(f"**Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"**Total Questions:** {len(QUESTIONS)}\n")
        f.write(f"**Backend URL:** {API_URL}\n\n")
        
        f.write("## Detailed Results\n\n")
        for res in results:
            f.write(f"### Q{res['id']}: {res['question']}\n")
            f.write(f"- **Latency:** {res['latency_sec']}s\n")
            f.write(f"- **Answer:** {res['answer']}\n\n")
            f.write("---\n\n")
    print(f"✅ Testing complete. Results saved to {OUTPUT_FILE}")
if __name__ == "__main__":
    run_tests()