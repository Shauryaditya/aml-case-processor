import React from 'react'

interface Transaction {
  Date: string
  amount: number | string
  Type: string
  Details: string
}

interface Props {
  transactions?: Transaction[]
}

const TransactionTable = ({ transactions = [] }: Props) => {
  return (
    <div>
      <div className="text-sm font-medium mb-2">Transactions</div>

      <div className="overflow-auto border rounded h-80">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="p-2">Date</th>
              <th className="p-2">Amount</th>
              <th className="p-2">Type</th>
              <th className="p-2">Details</th>
            </tr>
          </thead>

          <tbody>
            {transactions.length > 0 ? (
              transactions.map((t, idx) => (
                <tr key={idx} className="border-t">
                  <td className="p-2 text-xs">{t.Date}</td>
                  <td className="p-2 text-xs">{t.amount}</td>
                  <td className="p-2 text-xs">{t.Type}</td>
                  <td className="p-2 text-xs">{t.Details}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="p-2 text-sm text-gray-500">
                  No transactions returned
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default TransactionTable
