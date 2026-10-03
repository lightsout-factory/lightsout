interface Params {
	total: number;
}

export const getDiscount = ({ total }: Params): number => {
	let discount = 0;

	if (total >= 100) {
		discount = total / 10;
	}

	return discount;
};
