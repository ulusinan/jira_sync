#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class JiraSyncAPITester:
    def __init__(self, base_url="https://cloudbridge-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.user_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_register(self, email, password, name):
        """Test user registration"""
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "email": email,
                "password": password,
                "name": name
            }
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response.get('user', {}).get('id')
            return True
        return False

    def test_login(self, email, password):
        """Test user login"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={
                "email": email,
                "password": password
            }
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response.get('user', {}).get('id')
            return True
        return False

    def test_get_me(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "dashboard/stats",
            200
        )
        return success

    def test_jira_settings_get(self):
        """Test get Jira settings (should return null for new user)"""
        success, response = self.run_test(
            "Get Jira Settings",
            "GET",
            "settings/jira",
            200
        )
        return success

    def test_project_mappings(self):
        """Test get project mappings"""
        success, response = self.run_test(
            "Get Project Mappings",
            "GET",
            "projects/mappings",
            200
        )
        return success

    def test_issue_type_mappings(self):
        """Test get issue type mappings"""
        success, response = self.run_test(
            "Get Issue Type Mappings",
            "GET",
            "issuetypes/mappings",
            200
        )
        return success

    def test_transfer_logs(self):
        """Test get transfer logs"""
        success, response = self.run_test(
            "Get Transfer Logs",
            "GET",
            "logs",
            200
        )
        return success

    def test_sync_status(self):
        """Test get sync status"""
        success, response = self.run_test(
            "Get Sync Status",
            "GET",
            "sync/status",
            200
        )
        return success

def main():
    print("🚀 Starting JiraSync API Tests...")
    print("=" * 50)
    
    # Setup
    tester = JiraSyncAPITester()
    timestamp = datetime.now().strftime('%H%M%S')
    test_email = f"test_user_{timestamp}@example.com"
    test_password = "TestPass123!"
    test_name = f"Test User {timestamp}"

    # Test user registration
    print("\n📝 Testing User Registration...")
    if not tester.test_register(test_email, test_password, test_name):
        print("❌ Registration failed, stopping tests")
        return 1

    # Test authentication endpoints
    print("\n🔐 Testing Authentication...")
    if not tester.test_get_me():
        print("❌ Get current user failed")

    # Test login with same credentials
    print("\n🔑 Testing Login...")
    tester.token = None  # Clear token to test login
    if not tester.test_login(test_email, test_password):
        print("❌ Login failed")
        return 1

    # Test dashboard endpoints
    print("\n📊 Testing Dashboard Endpoints...")
    tester.test_dashboard_stats()

    # Test settings endpoints
    print("\n⚙️ Testing Settings Endpoints...")
    tester.test_jira_settings_get()

    # Test project mappings
    print("\n📁 Testing Project Mappings...")
    tester.test_project_mappings()

    # Test issue type mappings
    print("\n🏷️ Testing Issue Type Mappings...")
    tester.test_issue_type_mappings()

    # Test transfer logs
    print("\n📋 Testing Transfer Logs...")
    tester.test_transfer_logs()

    # Test sync status
    print("\n🔄 Testing Sync Status...")
    tester.test_sync_status()

    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️ {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())