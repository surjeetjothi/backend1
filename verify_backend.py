
import requests

def test_backend():
    url = "http://127.0.0.1:8000/api/login"
    payload = {
        "username": "parent_g1",
        "password": "123", # Password from create_grade1_parent.py
        "role": "Parent"
    }
    
    try:
        print(f"Testing Login to {url}...")
        res = requests.post(url, json=payload)
        
        print(f"Status Code: {res.status_code}")
        if res.status_code == 200:
            print("Login Successful!")
            print("Response:", res.json())
        else:
            print("Login Failed!")
            print("Response:", res.text)
            
    except Exception as e:
        print(f"Connection Error: {e}")

if __name__ == "__main__":
    test_backend()
