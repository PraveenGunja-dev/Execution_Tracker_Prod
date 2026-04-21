import base64
import sys

def generate_basic_token(email, password):
    credentials = f"{email}:{password}"
    # Base64 encode the string
    encoded_bytes = base64.b64encode(credentials.encode('utf-8'))
    encoded_str = encoded_bytes.decode('utf-8')
    
    print("\n--- Basic Auth Token Generator ---")
    print(f"Email:    {email}")
    print(f"Password: {password}")
    print(f"\nYour Auth Header should be:")
    print(f"Authorization: Basic {encoded_str}")
    print("----------------------------------\n")
    return encoded_str

if __name__ == "__main__":
    if len(sys.argv) == 3:
        generate_basic_token(sys.argv[1], sys.argv[2])
    else:
        print("Usage: python generate_basic_token.py <email> <password>")
        print("Example: python generate_basic_token.py superadmin@adani.com adani123")
        # Generate for demo accounts by default
        print("\nDefault Demo Accounts:")
        generate_basic_token("superadmin@adani.com", "adani123")
        generate_basic_token("admin@adani.com", "adani123456")
