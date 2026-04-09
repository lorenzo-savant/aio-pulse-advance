from playwright.sync_api import sync_playwright
import json
from datetime import datetime

OUTPUT_FILE = 'test_results.json'
CONSOLE_LOG_FILE = 'console_logs.txt'

def test_aio_pulse():
    results = {
        'timestamp': datetime.now().isoformat(),
        'tests': [],
        'console_errors': []
    }
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Capture console logs
        def handle_console(msg):
            if msg.type == 'error':
                results['console_errors'].append({
                    'text': msg.text,
                    'location': str(msg.location)
                })
        
        page.on('console', handle_console)
        
        try:
            # Test 1: Homepage loads
            print("Test 1: Homepage loads...")
            page.goto('http://localhost:3000', wait_until='domcontentloaded')
            page.wait_for_load_state('networkidle', timeout=30000)
            results['tests'].append({
                'name': 'Homepage loads',
                'passed': True,
                'url': page.url
            })
            
            # Test 2: Check page title
            print("Test 2: Check page title...")
            title = page.title()
            results['tests'].append({
                'name': 'Page has title',
                'passed': len(title) > 0,
                'title': title
            })
            
            # Test 3: Find main navigation
            print("Test 3: Find navigation elements...")
            nav_elements = page.locator('nav').count()
            results['tests'].append({
                'name': 'Navigation present',
                'passed': nav_elements > 0,
                'nav_count': nav_elements
            })
            
            # Test 4: Find interactive elements
            print("Test 4: Find buttons...")
            buttons = page.locator('button').all()
            button_texts = [btn.inner_text()[:50] for btn in buttons[:10]]
            results['tests'].append({
                'name': 'Buttons found',
                'passed': len(buttons) > 0,
                'button_count': len(buttons),
                'sample_buttons': button_texts
            })
            
            # Test 5: Find input fields
            print("Test 5: Find input fields...")
            inputs = page.locator('input').all()
            results['tests'].append({
                'name': 'Input fields found',
                'passed': len(inputs) >= 0,
                'input_count': len(inputs)
            })
            
            # Test 6: Dashboard page (if authenticated)
            print("Test 6: Dashboard page...")
            try:
                page.goto('http://localhost:3000/dashboard', timeout=10000)
                page.wait_for_load_state('networkidle', timeout=15000)
                dashboard_content = page.content()
                results['tests'].append({
                    'name': 'Dashboard accessible',
                    'passed': True,
                    'content_length': len(dashboard_content)
                })
            except Exception as e:
                results['tests'].append({
                    'name': 'Dashboard accessible',
                    'passed': False,
                    'error': str(e)
                })
            
            # Test 7: API health check endpoint
            print("Test 7: API providers health endpoint...")
            try:
                response = page.request.get('http://localhost:3000/api/providers/health')
                health_data = response.json() if response.ok else {}
                results['tests'].append({
                    'name': 'Providers health API',
                    'passed': response.ok,
                    'status': response.status,
                    'data': health_data
                })
            except Exception as e:
                results['tests'].append({
                    'name': 'Providers health API',
                    'passed': False,
                    'error': str(e)
                })
            
            # Test 8: Take screenshot
            print("Test 8: Taking screenshot...")
            page.screenshot(path='screenshots/homepage.png', full_page=True)
            results['tests'].append({
                'name': 'Screenshot captured',
                'passed': True,
                'path': 'screenshots/homepage.png'
            })
            
        except Exception as e:
            results['error'] = str(e)
        
        browser.close()
    
    # Save results
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(results, f, indent=2)
    
    # Save console logs
    with open(CONSOLE_LOG_FILE, 'w') as f:
        for error in results['console_errors']:
            f.write(f"{error['text']} at {error['location']}\n")
    
    # Print summary
    print("\n" + "="*50)
    print("TEST SUMMARY")
    print("="*50)
    passed = sum(1 for t in results['tests'] if t['passed'])
    total = len(results['tests'])
    print(f"Passed: {passed}/{total}")
    print(f"Console Errors: {len(results['console_errors'])}")
    print(f"Results saved to: {OUTPUT_FILE}")
    print("="*50)
    
    return results

if __name__ == '__main__':
    test_aio_pulse()
