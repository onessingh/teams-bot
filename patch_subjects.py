import re

with open('dashboard/app.js', 'r', encoding='utf-8') as f:
    text = f.read()

new_subjects = '''const subjectsData = {
    "1": [
        "Organisational Behavior", "Data Analysis and Decision Tools", "Managerial Economics", 
        "Accounting for Managers", "Marketing Management", "Human Resource Management", 
        "Business Communication", "Information Technology Management"
    ],
    "2": [
        "Organisation Effectiveness and Change", "Decision Modelling and Optimisation", 
        "Economic Environment of Business", "Corporate Finance", "Management Accounting", 
        "Production and Operations Management", "Marketing Research", "Management of Information Systems"
    ],
    "3": [
        "Core: Business Ethics and Sustainability", "Core: Strategic Analysis", "Core: Entrepreneurship, Creativity and Innovation",
        "Finance: Security Analysis and Portfolio Management", "Finance: International Financial Management", "Finance: Financial Derivatives", 
        "Finance: Financial Markets and Institutions", "Finance: Mergers and Corporate Restructuring",
        "Marketing: Consumer Behavior", "Marketing: Advertising Management", "Marketing: Services Marketing", "Marketing: Brand Management", "Marketing: Digital Marketing",
        "OB & HRM: Performance Management and Training Intervention", "OB & HRM: Compensation and Rewards Management", 
        "OB & HRM: Human Resource Development: Strategies and Systems", "OB & HRM: Cross Cultural and Global Management", "OB & HRM: Leadership, Power and Politics"
    ],
    "4": [
        "Core: Legal Environment of Business", "Core: Strategic Management", "Core: Global Business Management",
        "Finance: Quantitative Analysis of Financial Decisions", "Finance: Merchant Banking and Financial Services", "Finance: Financial Risk Management", 
        "Finance: Fixed Income Securities", "Finance: Financial Reporting",
        "Marketing: Competitive Marketing", "Marketing: Business Marketing", "Marketing: Sales Force Management", "Marketing: Marketing Analytics", "Marketing: Rural Marketing",
        "OB & HRM: Human Resource Metrics and Analytics", "OB & HRM: Managing Interpersonal and Group Processes", "OB & HRM: Counseling Skills for Managers", 
        "OB & HRM: Management of Industrial Relations", "OB & HRM: Negotiation and Influence Skills",
        "Operations: Operations Strategy", "Operations: Technology, Innovation and New Product Management", "Operations: System Optimization and Management Science", 
        "Operations: Supply Chain Analytics", "Operations: Supply Chain Management",
        "Strategy: Strategic Capability Building and Innovation", "Strategy: Strategic Management in Social Enterprises", "Strategy: International Business Strategy", 
        "Strategy: Strategic Management of Startups", "Strategy: Strategic Innovation in Health Care and Education",
        "Additional: Artificial Intelligence and Deep Learning", "Additional: Predictive Analytics and Big Data"
    ]
};'''

text = re.sub(r'const subjectsData = \{.*?\}\];', new_subjects, text, flags=re.DOTALL)
text = re.sub(r'const subjectsData = \{.*?\n\};\n\nfunction', new_subjects + '\n\nfunction', text, flags=re.DOTALL)

with open('dashboard/app.js', 'w', encoding='utf-8') as f:
    f.write(text)
