import csv

input_file = "/Users/sergiocaciatore/Documents/CMS/prices.csv"
output_file = "/Users/sergiocaciatore/Documents/CMS/frontend/src/data/lpu_prices.ts"

prices = {}

with open(input_file, "r") as f:
    # Use tab delimiter
    reader = csv.reader(f, delimiter="\t")
    for row in reader:
        if len(row) < 4:
            continue

        item_id = row[0].strip()
        price_str = row[3].strip()

        # Clean price string
        # Remove R$, spaces
        clean_price = price_str.replace("R$", "").strip()

        if "n/a" in clean_price.lower() or not clean_price:
            continue

        # Convert Brazilian format (1.200,50) to float (1200.50)
        # Remove dots (thousands separator)
        clean_price = clean_price.replace(".", "")
        # Replace comma with dot (decimal separator)
        clean_price = clean_price.replace(",", ".")

        try:
            val = float(clean_price)
            prices[item_id] = val
        except ValueError:
            print(f"Skipping invalid price for {item_id}: {price_str}")
            continue

# Generate TS content
ts_content = "export const LPU_PRICES: Record<string, number> = {\n"
for k, v in prices.items():
    ts_content += f'  "{k}": {v},\n'
ts_content += "};\n"

with open(output_file, "w") as f:
    f.write(ts_content)

print(f"Generated {output_file} with {len(prices)} items.")
