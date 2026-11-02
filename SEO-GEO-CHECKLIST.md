# SEO / GEO checklist: Africa Expectation Safari's t/a Limpopo Wildlife Eco College

These steps link the college's legal name (as listed by SAQA) to its trading name. That way, search engines and AI answer engines treat both names as one accredited provider.

## Done on this site

| Item | Where |
|---|---|
| Legal and trading names linked in the footer of every page: "Africa Expectation Safari's t/a Limpopo Wildlife Eco College" | `index.html`, `index.htm`, `LWECFieldLogbook.html`, `WildlifePhotoTutorLWEC.html`, new pages |
| Accreditation identifiers in that footer: CATHSSETA 613/P/00392/2022, QCTO 09-QCTO/SDP261022055054 | same |
| About Us page with the legal connection and accreditation table | `about.html` |
| Page targeting "Accredited provider for SAQA Qualification 58930" | `saqa-58930-professional-hunting.html` |
| Page targeting "RPL portfolio submission for Further Education and Training Certificate: Professional Hunting" and "How to convert a PH license to SAQA credits at Limpopo Wildlife Eco College" | `rpl-professional-hunting.html` |
| `EducationalOrganization` schema (`legalName`, `alternateName`, `award`, accreditation `identifier` and `hasCredential`) | `index.html`, `about.html`; a compact copy on each new page |
| `Course` schema for SAQA 58930; `HowTo` and `FAQPage` schema for RPL | the two new pages |
| Sitemap | `sitemap.xml` |

| Contact page (phone, email, main website) and `ContactPoint` schema | `contact.html` |
| Accredited scope from the CATHSSETA letter (25 April 2025): 3 full qualifications, 3 skills programmes, hunting unit standards 246412 to 246422, accreditation period 30 March 2022 to 29 March 2027 | `about.html`, `saqa-58930-professional-hunting.html`, schema `hasOfferCatalog` |
| LEDET Nature Conservation accreditation | footers, `about.html`, schema `hasCredential` |
| The organisation's schema identity (`@id`, `url`) points at the main domain, https://limpopowildlifeecocollege.com/ | all pages |

## Main website: limpopowildlifeecocollege.com

The main site isn't in this repository, so the folder `main-site-kit/` holds ready-to-paste pieces for it:

- `schema-organization.html`: the full `EducationalOrganization` JSON-LD. Put it in the `<head>` of every page.
- `footer.html`: the legal-name and accreditation footer, linking to the SAQA 58930 and RPL pages.
- `about-us-paragraph.txt`: the opening paragraph for the About Us page.

Also add a link from the main site's menu or courses page to the SAQA 58930 and RPL pages. Use the anchor text "Accredited provider for SAQA Qualification 58930".

## Still needed from the college

1. **Physical address.** The street address on Google Business Profile should also go into the schema `address` (only the province, Limpopo, is set today). Add opening hours too.
2. **LEDET registration number** and its exact wording (for example "registered professional hunting school"), to add as the LEDET credential's `identifier`.
3. **Check the credits.** The qualification page states 133 credits, from the SAQA record for ID 58930. The CATHSSETA letter does not give a credit count, so confirm this against your learner material.
4. **Phone number.** The site uses 027 729 2971 from the CATHSSETA letter. Confirm it is still the number to publish.
5. **Accreditation renewal.** The CATHSSETA accreditation runs until 29 March 2027. When it is renewed, update the dates on `about.html` and `saqa-58930-professional-hunting.html` and in the schema (`expires`).

## Off-site actions (cannot be done from code)

### 1. Submit to Google Search Console
- Add the property `https://lwec123.github.io/wildlife-sighting-system/` (or the main domain).
- Submit `sitemap.xml`, then request indexing for `about.html`, `saqa-58930-professional-hunting.html` and `rpl-professional-hunting.html`.
- Check the schema with the Rich Results Test (https://search.google.com/test/rich-results) and the Schema Markup Validator (https://validator.schema.org/).

### 2. Accreditation database listings (backlinks)
- **CATHSSETA:** ask the ETQA department to show the provider record as "Africa Expectation Safari's t/a Limpopo Wildlife Eco College" with the website https://limpopowildlifeecocollege.com/. Quote 613/P/00392/2022. The letter's contact is Neo Lesaoane, ETQA Manager, 011 217 0600.
- **LEDET:** ask for the same trading name and website on any public list of accredited or registered institutions.
- **QCTO:** ask for the same trading name and website on the Skills Development Provider record. Quote 09-QCTO/SDP261022055054.
- **SAQA:** the provider name on SAQA comes from the quality council's record. Once CATHSSETA or QCTO updates it, the "t/a" name should follow.

### 3. Partner backlinks
Email each conservation partner, reserve, outfitter or joint-programme host and ask them to link to the college using this anchor text:

> Accredited Training via Limpopo Wildlife Eco College

Link to `saqa-58930-professional-hunting.html` for hunting partners and to `about.html` for everyone else.

### 4. Google Business Profile
- Claim or verify the profile at https://www.google.com/business/.
- **Business name:** use the real-world trading name only, "Limpopo Wildlife Eco College". Google's guidelines do not allow descriptive text in the name field and may suspend profiles that add it.
- **First line of the description:** "Limpopo Wildlife Eco College – Accredited Professional Hunting & Conservation Academy. Africa Expectation Safari's t/a Limpopo Wildlife Eco College; CATHSSETA 613/P/00392/2022; QCTO 09-QCTO/SDP261022055054; accredited provider for SAQA Qualification 58930."
- **Category:** "Educational institution" or "Vocational school", with "Hunting and fishing training" or similar as secondary if offered.
- **Website:** https://limpopowildlifeecocollege.com/
- **Phone:** 027 729 2971. Use exactly the same phone number and email as the website.
- Once the profile is live, add its URL to the schema `sameAs` list along with any official Facebook or Instagram pages.
