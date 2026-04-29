-- FAQ heading must be: "Frequently Asked Questions About {primary keyword}"

UPDATE guardrail_templates
SET template_content = E'## [H1 Topic]\n\n[Opening paragraph - pain point focused]\n\n## Key Takeaways\n\n- [Takeaway 1]\n- [Takeaway 2]\n- [Takeaway 3]\n\n(EXACTLY 3 bullets — no more, no less)\n\n## [Major Section]\n\n[Content...]\n\n### [Subsection if needed]\n\n[Content...]\n\n## [Next Major Section]\n\n## Frequently Asked Questions About [primary keyword]\n\n### [Question 1]\n\n[Answer]\n\n### [Question 2]\n\n[Answer]\n\n### [Question 3]\n\n[Answer]\n\n### [Question 4]\n\n[Answer]\n\n### [Question 5]\n\n[Answer]\n\n(EXACTLY 5 FAQ items, heading must be "Frequently Asked Questions About {primary keyword}")'
WHERE content_type = 'blog' AND field_name = 'structure';

UPDATE guardrail_templates
SET template_content = E'## [H1 Topic]\n\n[Opening paragraph - pain point focused, bottom of funnel]\n\n(NO "Key Takeaways" section — shoppables go straight from intro to product/feature content)\n\n## [Major Section]\n\n[Content with embedded product mentions]\n\n### [Subsection]\n\n[Content...]\n\n## [Next Major Section]\n\n## Frequently Asked Questions About [primary keyword]\n\n### [Question 1]\n\n[Answer]\n\n### [Question 2]\n\n[Answer]\n\n### [Question 3]\n\n[Answer]\n\n### [Question 4]\n\n[Answer]\n\n### [Question 5]\n\n[Answer]\n\n(EXACTLY 5 FAQ items, heading must be "Frequently Asked Questions About {primary keyword}")'
WHERE content_type = 'shoppable' AND field_name = 'structure';
