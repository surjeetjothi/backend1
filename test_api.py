import requests
import json

BASE_URL = "http://127.0.0.1:8000/api"

def test_student_data(student_id):
    print(f"Testing /students/{student_id}/data...")
    headers = {
        "X-User-Role": "Student",
        "X-User-Id": student_id
    }
    try:
        response = requests.get(f"{BASE_URL}/students/{student_id}/data", headers=headers)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("Success!")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"Failed: {response.text}")
    except Exception as e:
        print(f"Connection Error: {e}")

if __name__ == "__main__":
    # Test valid student
    test_student_data("S001")
    
    # Test another valid student
    test_student_data("SURJEET")
    
    # Test fetching 'teacher' data as a student (should fail)
    test_student_data("teacher")
