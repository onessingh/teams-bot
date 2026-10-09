import re

with open('dashboard/app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Add subjects object and logic at the end
logic = '''
// SUBJECT MAPPING LOGIC
const subjectsData = {
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
        "Business Ethics and Sustainability", "Strategic Analysis", "Entrepreneurship, Creativity and Innovation",
        "Security Analysis and Portfolio Management", "International Financial Management", "Financial Derivatives", 
        "Financial Markets and Institutions", "Mergers and Corporate Restructuring",
        "Consumer Behavior", "Advertising Management", "Services Marketing", "Brand Management", "Digital Marketing",
        "Performance Management and Training Intervention", "Compensation and Rewards Management", 
        "Human Resource Development: Strategies and Systems", "Cross Cultural and Global Management", "Leadership, Power and Politics"
    ],
    "4": [
        "Legal Environment of Business", "Strategic Management", "Global Business Management",
        "Quantitative Analysis of Financial Decisions", "Merchant Banking and Financial Services", "Financial Risk Management", 
        "Fixed Income Securities", "Financial Reporting",
        "Competitive Marketing", "Business Marketing", "Sales Force Management", "Marketing Analytics", "Rural Marketing",
        "Human Resource Metrics and Analytics", "Managing Interpersonal and Group Processes", "Counseling Skills for Managers", 
        "Management of Industrial Relations", "Negotiation and Influence Skills",
        "Operations Strategy", "Technology, Innovation and New Product Management", "System Optimization and Management Science", 
        "Supply Chain Analytics", "Supply Chain Management",
        "Strategic Capability Building and Innovation", "Strategic Management in Social Enterprises", "International Business Strategy", 
        "Strategic Management of Startups", "Strategic Innovation in Health Care and Education",
        "Artificial Intelligence and Deep Learning", "Predictive Analytics and Big Data"
    ]
};

function populateSubjects(semId, subjId) {
    const semSelect = document.getElementById(semId);
    const subjSelect = document.getElementById(subjId);
    
    semSelect.addEventListener('change', (e) => {
        const sem = e.target.value;
        subjSelect.innerHTML = '<option value="">-- Select Subject --</option>';
        if (sem && subjectsData[sem]) {
            subjectsData[sem].forEach(subj => {
                const opt = document.createElement('option');
                opt.value = subj;
                opt.innerText = subj;
                subjSelect.appendChild(opt);
            });
        }
    });
}

populateSubjects('vod-semester', 'vod-subject');
populateSubjects('live-semester', 'live-subject');
'''

if 'SUBJECT MAPPING LOGIC' not in text:
    text += logic

with open('dashboard/app.js', 'w', encoding='utf-8') as f:
    f.write(text)
